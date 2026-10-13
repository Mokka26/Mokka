"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendShippingConfirmation } from "@/lib/email";
import { logAdminError } from "../_lib/log";
import { FULFILLMENT_STATUSES } from "../_lib/order-status";

function revalidateOrders(id?: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  if (id) revalidatePath(`/admin/orders/${id}`);
}

// ─────────────────────────────────────────────────────────────────────
// Verwijderen / archiveren
//   - niet-betaalde bestellingen (open/failed/canceled/expired): hard delete
//     (OrderItem gaat mee via onDelete: Cascade);
//   - betaalde bestellingen: NOOIT verwijderen (bewaarplicht administratie)
//     maar archiveren (archivedAt) — uit de lijst, wel bewaard.
// ─────────────────────────────────────────────────────────────────────

const deleteSchema = z.object({
  id: z.string().min(1),
  /** Voor betaalde bestellingen: het getypte ordernummer. */
  confirmation: z.string().max(40).optional(),
});

export type DeleteOrderResult = { ok: true; archived: boolean } | { ok: false; error: string };

export async function deleteOrder(input: z.infer<typeof deleteSchema>): Promise<DeleteOrderResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, orderNumber: true, status: true, archivedAt: true },
  });
  if (!order) return { ok: false, error: "Bestelling niet gevonden (al verwijderd?)" };

  if (order.status === "paid") {
    if (parsed.data.confirmation?.trim() !== order.orderNumber) {
      return {
        ok: false,
        error: `Dit is een betaalde bestelling. Typ het ordernummer ${order.orderNumber} om te bevestigen.`,
      };
    }
    if (order.archivedAt) return { ok: false, error: "Deze bestelling is al gearchiveerd." };
    try {
      await prisma.order.update({ where: { id: order.id }, data: { archivedAt: new Date() } });
    } catch (e) {
      logAdminError("archiveOrder", e, { orderId: order.id });
      return { ok: false, error: "Archiveren mislukt. Probeer het opnieuw." };
    }
    revalidateOrders(order.id);
    return { ok: true, archived: true };
  }

  try {
    await prisma.order.delete({ where: { id: order.id } });
  } catch (e) {
    logAdminError("deleteOrder", e, { orderId: order.id });
    return { ok: false, error: "Verwijderen mislukt. Probeer het opnieuw." };
  }

  revalidateOrders(order.id);
  return { ok: true, archived: false };
}

// ─────────────────────────────────────────────────────────────────────
// Afhandeling: status, tracking, notitie — plus verzendmail bij "verzonden"
// ─────────────────────────────────────────────────────────────────────

const fulfillmentSchema = z.object({
  id: z.string().min(1),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES, { error: "Kies een afhandelstatus" }),
  trackingCode: z.string().trim().max(100, "Maximaal 100 tekens").nullable(),
  trackingUrl: z
    .string()
    .trim()
    .max(500, "Maximaal 500 tekens")
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Begin met https://")
    .nullable(),
  adminNote: z.string().trim().max(2000, "Maximaal 2000 tekens").nullable(),
});

type FulfillmentField = "fulfillmentStatus" | "trackingCode" | "trackingUrl" | "adminNote";

export type FulfillmentState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<FulfillmentField, string>>;
  /** Resultaat van de verzendmail bij overgang naar "verzonden". */
  mail?: "sent" | "failed" | "skipped";
  /** Verandert per opslag zodat de client een toast per keer kan tonen. */
  savedAt?: number;
};

function textOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

export async function updateOrderFulfillment(
  _prev: FulfillmentState,
  formData: FormData,
): Promise<FulfillmentState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };

  const parsed = fulfillmentSchema.safeParse({
    id: formData.get("id"),
    fulfillmentStatus: formData.get("fulfillmentStatus"),
    trackingCode: textOrNull(formData.get("trackingCode")),
    trackingUrl: textOrNull(formData.get("trackingUrl")),
    adminNote: textOrNull(formData.get("adminNote")),
  });
  if (!parsed.success) {
    const fieldErrors: FulfillmentState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key as FulfillmentField] = issue.message;
    }
    return { fieldErrors };
  }

  const { id, ...data } = parsed.data;
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { id: true, fulfillmentStatus: true, shippedAt: true },
  });
  if (!existing) return { error: "Bestelling niet gevonden" };

  const toShipped = data.fulfillmentStatus === "shipped";
  // Overgang naar "verzonden": conditioneel (status nog niet shipped) zodat
  // twee tegelijk opgeslagen formulieren of een dubbelklik precies één
  // verzendmail opleveren — alleen de aanroep die de rij flipt (count === 1)
  // mailt.
  let becameShipped = false;
  try {
    if (toShipped && existing.fulfillmentStatus !== "shipped") {
      const flip = await prisma.order.updateMany({
        where: { id, fulfillmentStatus: { not: "shipped" } },
        data: { ...data, shippedAt: existing.shippedAt ?? new Date() },
      });
      becameShipped = flip.count === 1;
      if (!becameShipped) {
        // Iemand anders was ons voor: dan alleen de tekstvelden bijwerken.
        await prisma.order.update({ where: { id }, data });
      }
    } else {
      await prisma.order.update({ where: { id }, data: { ...data, shippedAt: toShipped ? (existing.shippedAt ?? new Date()) : existing.shippedAt } });
    }
  } catch (e) {
    logAdminError("updateOrderFulfillment", e, { orderId: id });
    return { error: "Opslaan mislukt. Probeer het opnieuw." };
  }

  let mail: FulfillmentState["mail"] = "skipped";
  if (becameShipped) {
    try {
      const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });
      if (!updated) return { error: "Bestelling niet gevonden" };
      const result: unknown = await sendShippingConfirmation(updated);
      mail = result === false ? "failed" : "sent";
    } catch (e) {
      logAdminError("sendShippingConfirmation", e, { orderId: id });
      mail = "failed";
    }
  }

  revalidateOrders(id);
  return { ok: true, mail, savedAt: Date.now() };
}
