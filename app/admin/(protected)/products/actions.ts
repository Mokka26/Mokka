"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { extractPublicId } from "@/lib/cloudinary-helpers";
import { parseImages } from "@/lib/imageHelpers";
import { parsePrice, parseRequiredPrice } from "@/lib/parse-price";
import { revalidateAllProducts, revalidateProduct } from "@/lib/revalidate";
import { logAdminError } from "../_lib/log";
import { VALID_DB_CATEGORIES } from "../_lib/db-categories";
import { parseAdminImages, type AdminImage } from "../_lib/images";

const CONFLICT_ERROR = "Dit product is intussen elders gewijzigd. Herlaad de pagina.";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

const categorySchema = z.enum(VALID_DB_CATEGORIES, { error: "Kies een geldige categorie" });

// ─────────────────────────────────────────────────────────────────────
// Publiceerbaarheid: zichtbaar maken mag alleen met prijs én foto
// ─────────────────────────────────────────────────────────────────────

type SizeVariantRow = { label: string; price?: number; listPrice?: number };

/** Prijs > 0, óf elke maat heeft een eigen prijs > 0 (basisprijs mag dan 0 zijn). */
function hasSellablePrice(price: number, sizeVariantsJson: string | null): boolean {
  if (price > 0) return true;
  if (!sizeVariantsJson) return false;
  try {
    const arr: unknown = JSON.parse(sizeVariantsJson);
    if (!Array.isArray(arr) || arr.length === 0) return false;
    return arr.every((v) => v && typeof v === "object" && typeof (v as SizeVariantRow).price === "number" && (v as SizeVariantRow).price! > 0);
  } catch {
    return false;
  }
}

/** Redenen waarom een product (nog) niet zichtbaar mag; leeg = publiceerbaar. */
function publishBlockers(p: { price: number; images: string; sizeVariants: string | null }): string[] {
  const reasons: string[] = [];
  if (!hasSellablePrice(p.price, p.sizeVariants)) reasons.push("geen prijs");
  if (parseImages(p.images).length === 0) reasons.push("geen foto");
  return reasons;
}

function blockersMessage(items: { name: string; reasons: string[] }[]): string {
  const list = items.map((i) => `${i.name} (${i.reasons.join(", ")})`).join("; ");
  return items.length === 1
    ? `${list} kan niet zichtbaar worden. Vul eerst een prijs en minstens één foto in.`
    : `${items.length} producten kunnen niet zichtbaar worden: ${list}. Vul eerst een prijs en minstens één foto in.`;
}

/** Ververst de PDP's van alle kleurvarianten (prijs werkt daar door). */
async function revalidateColorGroup(colorGroup: string): Promise<void> {
  const siblings = await prisma.product.findMany({
    where: { colorGroup, deletedAt: null },
    select: { slug: true, category: true },
  });
  for (const s of siblings) revalidateProduct(s);
}

// ─────────────────────────────────────────────────────────────────────
// Inline updates (prijs, uitgelicht, voorraad, zichtbaar)
// ─────────────────────────────────────────────────────────────────────

const inlineUpdateSchema = z.object({
  id: z.string().min(1),
  price: z.number().nonnegative().max(999999).optional(),
  featured: z.boolean().optional(),
  stock: z.number().int("Voorraad is een geheel getal").nonnegative("Voorraad kan niet negatief zijn").max(99999).optional(),
  hidden: z.boolean().optional(),
});

export type InlineUpdateInput = z.infer<typeof inlineUpdateSchema>;
export type InlineUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateProductInline(input: InlineUpdateInput): Promise<InlineUpdateResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = inlineUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { id, ...data } = parsed.data;
  if (Object.keys(data).length === 0) return { ok: true };

  const product = await prisma.product.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, name: true, slug: true, category: true, colorGroup: true, price: true, images: true, sizeVariants: true },
  });
  if (!product) return { ok: false, error: "Product niet gevonden" };

  if (data.hidden === false) {
    const reasons = publishBlockers({ ...product, price: data.price ?? product.price });
    if (reasons.length > 0) return { ok: false, error: blockersMessage([{ name: product.name, reasons }]) };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });
      // Prijswijziging werkt door op alle (niet-verwijderde) kleuren van hetzelfde model.
      if (data.price !== undefined && product.colorGroup) {
        await tx.product.updateMany({
          where: { colorGroup: product.colorGroup, deletedAt: null, id: { not: id } },
          data: { price: data.price },
        });
      }
    });
  } catch (e) {
    logAdminError("updateProductInline", e, { id, fields: Object.keys(data) });
    return { ok: false, error: "Opslaan mislukt. Probeer het opnieuw." };
  }

  revalidateProduct(product);
  if (data.price !== undefined && product.colorGroup) await revalidateColorGroup(product.colorGroup);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Bulkacties vanuit de productlijst
// ─────────────────────────────────────────────────────────────────────

const idsSchema = z.array(z.string().min(1)).min(1, "Selecteer minstens één product").max(500, "Maximaal 500 producten per keer");

const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("show"), ids: idsSchema }),
  z.object({ action: z.literal("hide"), ids: idsSchema }),
  z.object({ action: z.literal("feature"), ids: idsSchema, featured: z.boolean() }),
  z.object({ action: z.literal("category"), ids: idsSchema, category: categorySchema }),
  z.object({
    action: z.literal("price"),
    ids: idsSchema,
    mode: z.enum(["absolute", "percent"]),
    amount: z.number().finite(),
  }),
  z.object({ action: z.literal("trash"), ids: idsSchema }),
]);

export type BulkInput = z.infer<typeof bulkSchema>;
export type BulkResult =
  | { ok: true; changed: number; refused: { name: string; reasons: string[] }[]; message: string }
  | { ok: false; error: string };

/** Nieuwe prijs bij bulk-aanpassing; afgerond op centen. */
function applyPriceChange(price: number, mode: "absolute" | "percent", amount: number): number {
  const next = mode === "absolute" ? amount : price * (1 + amount / 100);
  return Math.round(next * 100) / 100;
}

export async function bulkUpdateProducts(input: BulkInput): Promise<BulkResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const data = parsed.data;

  const products = await prisma.product.findMany({
    where: { id: { in: data.ids }, deletedAt: null },
    select: { id: true, name: true, price: true, images: true, sizeVariants: true },
  });
  if (products.length === 0) return { ok: false, error: "Geen (actieve) producten gevonden voor deze selectie" };
  const ids = products.map((p) => p.id);

  try {
    switch (data.action) {
      case "show": {
        const refused: { name: string; reasons: string[] }[] = [];
        const okIds: string[] = [];
        for (const p of products) {
          const reasons = publishBlockers(p);
          if (reasons.length > 0) refused.push({ name: p.name, reasons });
          else okIds.push(p.id);
        }
        if (okIds.length > 0) {
          await prisma.product.updateMany({ where: { id: { in: okIds } }, data: { hidden: false } });
          revalidateAllProducts();
        }
        const message =
          okIds.length === 0
            ? blockersMessage(refused)
            : `${okIds.length} product${okIds.length === 1 ? "" : "en"} zichtbaar gemaakt.${refused.length > 0 ? ` Geweigerd: ${blockersMessage(refused)}` : ""}`;
        return { ok: true, changed: okIds.length, refused, message };
      }
      case "hide": {
        const r = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { hidden: true } });
        revalidateAllProducts();
        return { ok: true, changed: r.count, refused: [], message: `${r.count} product${r.count === 1 ? "" : "en"} verborgen.` };
      }
      case "feature": {
        const r = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { featured: data.featured } });
        revalidateAllProducts();
        return {
          ok: true,
          changed: r.count,
          refused: [],
          message: `${r.count} product${r.count === 1 ? "" : "en"} ${data.featured ? "uitgelicht" : "niet meer uitgelicht"}.`,
        };
      }
      case "category": {
        const r = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { category: data.category } });
        revalidateAllProducts();
        return {
          ok: true,
          changed: r.count,
          refused: [],
          message: `${r.count} product${r.count === 1 ? "" : "en"} verplaatst naar "${data.category}".`,
        };
      }
      case "price": {
        // Bulkprijs raakt alléén de geselecteerde producten (geen kleurgroep-
        // propagatie): de beheerder kiest hier expliciet welke producten.
        const refused: { name: string; reasons: string[] }[] = [];
        const updates: Prisma.PrismaPromise<unknown>[] = [];
        for (const p of products) {
          const next = applyPriceChange(p.price, data.mode, data.amount);
          if (!(next >= 0) || next > 999999) {
            refused.push({ name: p.name, reasons: ["ongeldige nieuwe prijs"] });
            continue;
          }
          updates.push(prisma.product.update({ where: { id: p.id }, data: { price: next } }));
        }
        if (updates.length > 0) {
          await prisma.$transaction(updates);
          revalidateAllProducts();
        }
        return {
          ok: true,
          changed: updates.length,
          refused,
          message: `Prijs aangepast voor ${updates.length} product${updates.length === 1 ? "" : "en"}.${
            refused.length > 0 ? ` Overgeslagen: ${refused.map((r) => r.name).join(", ")}.` : ""
          }`,
        };
      }
      case "trash": {
        const r = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
        revalidateAllProducts();
        revalidatePath("/admin/trash");
        return {
          ok: true,
          changed: r.count,
          refused: [],
          message: `${r.count} product${r.count === 1 ? "" : "en"} naar de prullenbak verplaatst.`,
        };
      }
    }
  } catch (e) {
    logAdminError("bulkUpdateProducts", e, { action: data.action, count: ids.length });
    return { ok: false, error: "Bulkactie mislukt. Er is niets gewijzigd." };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Volledig bewerken (formulier)
// ─────────────────────────────────────────────────────────────────────

const specsRecordSchema = z
  .record(z.string().min(1).max(50), z.string().min(1).max(200))
  .refine((r) => Object.keys(r).length <= 20, { message: "Max 20 specs" });

const sizeVariantsSchema = z
  .array(
    z.object({
      label: z.string().min(1).max(40),
      price: z.number().positive().max(999999).optional(),
      listPrice: z.number().positive().max(999999).optional(),
    }),
  )
  .max(12)
  .nullable();

/**
 * Maat-varianten uit het formulier. De editor stuurt prijzen als tekst
 * ("599,50"); elke onleesbare of onlogische prijs wordt een veldfout —
 * er wordt nooit stil op de basisprijs teruggevallen.
 */
function parseSizeVariants(raw: FormDataEntryValue | null): { value: SizeVariantRow[] | null; error?: string } {
  if (typeof raw !== "string" || !raw.trim()) return { value: null };
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return { value: null, error: "Maten konden niet gelezen worden" };
  }
  if (!Array.isArray(arr)) return { value: null, error: "Maten konden niet gelezen worden" };

  const out: SizeVariantRow[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const row = item as { label?: unknown; price?: unknown; listPrice?: unknown };
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label) continue;

    const price = parsePrice(typeof row.price === "number" ? String(row.price) : typeof row.price === "string" ? row.price : null);
    if (price.error) return { value: null, error: `Maat ${label}: ${price.error}` };
    if (price.value != null && price.value <= 0) return { value: null, error: `Maat ${label}: prijs moet groter dan 0 zijn (of leeg)` };

    const lp = parsePrice(typeof row.listPrice === "number" ? String(row.listPrice) : typeof row.listPrice === "string" ? row.listPrice : null);
    if (lp.error) return { value: null, error: `Maat ${label}: adviesprijs — ${lp.error}` };
    if (lp.value != null) {
      if (price.value == null) return { value: null, error: `Maat ${label}: adviesprijs alleen mogelijk met een eigen verkoopprijs` };
      if (lp.value <= price.value) return { value: null, error: `Maat ${label}: adviesprijs moet hoger zijn dan de verkoopprijs` };
    }

    const variant: SizeVariantRow = { label };
    if (price.value != null) variant.price = price.value;
    if (lp.value != null) variant.listPrice = lp.value;
    out.push(variant);
  }
  return { value: out.length > 0 ? out : null };
}

/** "included"/"optional" of null (= geen). */
function parseOptionMode(raw: FormDataEntryValue | null): "included" | "optional" | null {
  const m = typeof raw === "string" ? raw : "";
  return m === "included" || m === "optional" ? m : null;
}

/** Optionele toeslag-prijs: leeg of 0 → null (optie uit); onleesbaar → fout. */
function parseAddonPrice(raw: FormDataEntryValue | null): { value: number | null; error?: string } {
  const r = parsePrice(raw);
  if (r.error) return r;
  return { value: r.value && r.value > 0 ? r.value : null };
}

function parseSpecs(raw: FormDataEntryValue | null): Record<string, string> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string" && k.trim() && v.trim()) filtered[k.trim()] = v.trim();
    }
    return Object.keys(filtered).length > 0 ? filtered : null;
  } catch {
    return null;
  }
}

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bijv. #8B6F47").nullable();

const fullUpdateSchema = z.object({
  id: z.string().min(1),
  updatedAt: z.coerce.date({ error: "Het formulier is verouderd. Herlaad de pagina." }),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en streepjes"),
  name: z.string().min(2, "Minimaal 2 tekens").max(200),
  description: z.string().min(1, "Beschrijving is verplicht").max(5000),
  price: z.number().nonnegative().max(999999),
  listPrice: z.number().nonnegative().max(999999).nullable(),
  nachtkastMode: z.union([z.literal("included"), z.literal("optional")]).nullable(),
  nachtkastPrice: z.number().nonnegative().max(999999).nullable(),
  nachtkastPrice2: z.number().nonnegative().max(999999).nullable(),
  voetbankMode: z.union([z.literal("included"), z.literal("optional")]).nullable(),
  voetbankPrice: z.number().nonnegative().max(999999).nullable(),
  category: categorySchema,
  featured: z.boolean(),
  hidden: z.boolean(),
  specs: specsRecordSchema.nullable(),
  sizeVariants: sizeVariantsSchema,
  stock: z.number().int("Voorraad is een geheel getal").nonnegative("Voorraad kan niet negatief zijn").max(99999),
  deliveryTime: z.string().max(80).nullable(),
  colorGroup: z.string().max(80).nullable(),
  colorName: z.string().max(40).nullable(),
  colorHex: hexSchema,
  source: z.string().max(60).nullable(),
});

type FullField = keyof z.infer<typeof fullUpdateSchema>;

export type FullUpdateState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<FullField, string>>;
  /** Verandert per geslaagde opslag; de client reset dan de dirty-state. */
  savedAt?: number;
  /** Nieuwe updatedAt (ISO) na opslaan, voor de volgende optimistic lock. */
  updatedAt?: string;
};

export async function updateProductFull(_prev: FullUpdateState, formData: FormData): Promise<FullUpdateState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };

  // Prijzen eerst: elke onleesbare invoer wordt een veldfout.
  const fieldErrors: NonNullable<FullUpdateState["fieldErrors"]> = {};
  const price = parseRequiredPrice(formData.get("price"));
  if (price.error) fieldErrors.price = price.error;
  const listPrice = parsePrice(formData.get("listPrice"));
  if (listPrice.error) fieldErrors.listPrice = listPrice.error;
  else if (listPrice.value != null && price.value != null && listPrice.value <= price.value) {
    fieldErrors.listPrice = "Adviesprijs moet hoger zijn dan de verkoopprijs (of leeg)";
  }
  const nachtkastPrice = parseAddonPrice(formData.get("nachtkastPrice"));
  if (nachtkastPrice.error) fieldErrors.nachtkastPrice = nachtkastPrice.error;
  const nachtkastPrice2 = parseAddonPrice(formData.get("nachtkastPrice2"));
  if (nachtkastPrice2.error) fieldErrors.nachtkastPrice2 = nachtkastPrice2.error;
  const voetbankPrice = parseAddonPrice(formData.get("voetbankPrice"));
  if (voetbankPrice.error) fieldErrors.voetbankPrice = voetbankPrice.error;
  const sizeVariants = parseSizeVariants(formData.get("sizeVariants"));
  if (sizeVariants.error) fieldErrors.sizeVariants = sizeVariants.error;
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = /^\d+$/.test(stockRaw) ? Number(stockRaw) : NaN;
  if (!Number.isInteger(stock)) fieldErrors.stock = "Voorraad is een geheel getal van 0 of hoger";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const parsed = fullUpdateSchema.safeParse({
    id: formData.get("id"),
    updatedAt: formData.get("updatedAt"),
    slug: slugify(String(formData.get("slug") || "")),
    name: formData.get("name"),
    description: formData.get("description"),
    price: price.value,
    listPrice: listPrice.value,
    nachtkastMode: parseOptionMode(formData.get("nachtkastMode")),
    nachtkastPrice: nachtkastPrice.value,
    nachtkastPrice2: nachtkastPrice2.value,
    voetbankMode: parseOptionMode(formData.get("voetbankMode")),
    voetbankPrice: voetbankPrice.value,
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
    hidden: formData.get("hidden") === "on",
    specs: parseSpecs(formData.get("specs")),
    sizeVariants: sizeVariants.value,
    stock,
    deliveryTime: trimOrNull(formData.get("deliveryTime")),
    colorGroup: trimOrNull(formData.get("colorGroup")),
    colorName: trimOrNull(formData.get("colorName")),
    colorHex: trimOrNull(formData.get("colorHex")),
    source: trimOrNull(formData.get("source")),
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key as FullField] = issue.message;
    }
    return { fieldErrors };
  }

  const { id, updatedAt, specs, sizeVariants: variants, ...rest } = parsed.data;

  const existing = await prisma.product.findUnique({
    where: { id, deletedAt: null },
    select: { slug: true, category: true, images: true, colorGroup: true },
  });
  if (!existing) return { error: "Product niet gevonden (misschien in de prullenbak?)" };

  // Zichtbaar maken vereist prijs + foto — ook via het formulier.
  if (!rest.hidden) {
    const reasons = publishBlockers({
      price: rest.price,
      images: existing.images,
      sizeVariants: variants ? JSON.stringify(variants) : null,
    });
    if (reasons.length > 0) {
      return {
        fieldErrors: {
          hidden: `Kan niet zichtbaar worden: ${reasons.join(" en ")}. Vul eerst een prijs en minstens één foto in, of laat het product verborgen.`,
        },
      };
    }
  }

  const slugChanged = existing.slug !== rest.slug;
  const categoryChanged = existing.category !== rest.category;

  if (slugChanged) {
    const clash = await prisma.product.findUnique({ where: { slug: rest.slug }, select: { id: true } });
    if (clash) return { fieldErrors: { slug: "Deze URL is al in gebruik door een ander product" } };
  }

  let updated: { slug: string; category: string; colorGroup: string | null; updatedAt: Date };
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Optimistic lock: alleen bijwerken als niemand het product intussen
      // gewijzigd heeft (updatedAt uit het formulier moet nog kloppen).
      const row = await tx.product.update({
        where: { id, updatedAt },
        data: {
          ...rest,
          specs: specs ? JSON.stringify(specs) : null,
          sizeVariants: variants ? JSON.stringify(variants) : null,
        },
        select: { slug: true, category: true, colorGroup: true, updatedAt: true },
      });

      // Prijs + adviesprijs werken door op de andere kleuren van hetzelfde
      // model (zelfde colorGroup, niet verwijderd). Bewust NIET gedeeld:
      // sizeVariants, nachtkast/voetbank-opties, voorraad, foto's — die zijn
      // per kleur/configuratie en zouden elkaar anders overschrijven.
      if (row.colorGroup) {
        await tx.product.updateMany({
          where: { colorGroup: row.colorGroup, deletedAt: null, id: { not: id } },
          data: { price: rest.price, listPrice: rest.listPrice },
        });
      }

      if (slugChanged) {
        // Oude link blijft werken (301). Een redirect-rij die naar de nieuwe
        // slug wees is nu overbodig (de slug is weer live) → opruimen.
        await tx.slugRedirect.deleteMany({ where: { oldSlug: rest.slug } });
        await tx.slugRedirect.upsert({
          where: { oldSlug: existing.slug },
          create: { oldSlug: existing.slug, productId: id },
          update: { productId: id },
        });
      }
      return row;
    });
  } catch (e) {
    if (isNotFound(e)) return { error: CONFLICT_ERROR };
    logAdminError("updateProductFull", e, { id });
    return { error: "Opslaan mislukt. Probeer het opnieuw." };
  }

  revalidateProduct(
    updated,
    slugChanged || categoryChanged ? { slug: existing.slug, category: existing.category } : undefined,
  );
  if (updated.colorGroup) await revalidateColorGroup(updated.colorGroup);

  // Slug gewijzigd → de admin-bewerk-URL is verplaatst.
  if (slugChanged) redirect(`/admin/products/${updated.slug}?saved=1`);
  return { ok: true, savedAt: Date.now(), updatedAt: updated.updatedAt.toISOString() };
}

// ─────────────────────────────────────────────────────────────────────
// Foto's
// ─────────────────────────────────────────────────────────────────────

const productImageSchema = z.object({
  url: z.string().url(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  alt: z.string().trim().max(200, "Alt-tekst: maximaal 200 tekens").optional(),
});

const imagesUpdateSchema = z.object({
  id: z.string().min(1),
  images: z.array(productImageSchema).max(100),
});

/** Lege alt-tekst niet opslaan. */
function cleanImages(images: z.infer<typeof productImageSchema>[]): AdminImage[] {
  return images.map(({ url, w, h, alt }) => ({ url, ...(w ? { w } : {}), ...(h ? { h } : {}), ...(alt ? { alt } : {}) }));
}

export async function updateProductImages(
  input: z.infer<typeof imagesUpdateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = imagesUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };

  let updated: { slug: string; category: string };
  try {
    updated = await prisma.product.update({
      where: { id: parsed.data.id },
      data: { images: JSON.stringify(cleanImages(parsed.data.images)) },
      select: { slug: true, category: true },
    });
  } catch (e) {
    if (isNotFound(e)) return { ok: false, error: "Product niet gevonden" };
    logAdminError("updateProductImages", e, { id: parsed.data.id });
    return { ok: false, error: "Foto's opslaan mislukt. Probeer het opnieuw." };
  }

  revalidateProduct(updated);
  return { ok: true };
}

/** Bestandsformaten die Cloudinary mag accepteren (gesigneerd, dus niet te omzeilen). */
const ALLOWED_FORMATS = "jpg,png,webp,avif";

export async function getCloudinarySignature(
  folder: string,
): Promise<
  | {
      ok: true;
      signature: string;
      timestamp: number;
      apiKey: string;
      cloudName: string;
      folder: string;
      publicId: string;
      allowedFormats: string;
    }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!apiKey || !apiSecret || !cloudName) {
    return { ok: false, error: "Cloudinary niet geconfigureerd" };
  }

  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const signature = cloudinary.utils.api_sign_request(
    { allowed_formats: ALLOWED_FORMATS, folder: safeFolder, public_id: publicId, timestamp },
    apiSecret,
  );

  return {
    ok: true,
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: safeFolder,
    publicId,
    allowedFormats: ALLOWED_FORMATS,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Nieuw product
// ─────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(2, "Minimaal 2 tekens").max(200),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en streepjes"),
  description: z.string().min(1, "Beschrijving is verplicht").max(5000),
  price: z.number().nonnegative().max(999999),
  listPrice: z.number().nonnegative().max(999999).nullable().default(null),
  category: categorySchema,
  featured: z.boolean(),
  hidden: z.boolean(),
  images: z.array(productImageSchema).default([]),
  sizeVariants: sizeVariantsSchema.default(null),
  stock: z.number().int("Voorraad is een geheel getal").nonnegative("Voorraad kan niet negatief zijn").max(99999).default(10),
  deliveryTime: z.string().max(80).nullable().default(null),
  colorGroup: z.string().max(80).nullable().default(null),
  colorName: z.string().max(40).nullable().default(null),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bijv. #8B6F47").nullable().default(null),
  source: z.string().max(60).nullable().default(null),
});

type CreateField = keyof z.infer<typeof createSchema>;

export type CreateProductState = {
  error?: string;
  fieldErrors?: Partial<Record<CreateField, string>>;
};

export async function createProduct(_prev: CreateProductState, formData: FormData): Promise<CreateProductState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };

  const fieldErrors: NonNullable<CreateProductState["fieldErrors"]> = {};
  const price = parseRequiredPrice(formData.get("price"));
  if (price.error) fieldErrors.price = price.error;
  const listPrice = parsePrice(formData.get("listPrice"));
  if (listPrice.error) fieldErrors.listPrice = listPrice.error;
  else if (listPrice.value != null && price.value != null && listPrice.value <= price.value) {
    fieldErrors.listPrice = "Adviesprijs moet hoger zijn dan de verkoopprijs (of leeg)";
  }
  const sizeVariants = parseSizeVariants(formData.get("sizeVariants"));
  if (sizeVariants.error) fieldErrors.sizeVariants = sizeVariants.error;
  const stockRaw = String(formData.get("stock") ?? "10").trim();
  const stock = /^\d+$/.test(stockRaw) ? Number(stockRaw) : NaN;
  if (!Number.isInteger(stock)) fieldErrors.stock = "Voorraad is een geheel getal van 0 of hoger";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  let images: unknown = [];
  const rawImages = formData.get("images");
  if (typeof rawImages === "string" && rawImages.trim()) {
    try {
      images = JSON.parse(rawImages);
    } catch {
      return { error: "Foto's konden niet gelezen worden. Herlaad de pagina en probeer opnieuw." };
    }
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    description: formData.get("description"),
    price: price.value,
    listPrice: listPrice.value,
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
    hidden: formData.get("hidden") === "on",
    images,
    sizeVariants: sizeVariants.value,
    stock,
    deliveryTime: trimOrNull(formData.get("deliveryTime")),
    colorGroup: trimOrNull(formData.get("colorGroup")),
    colorName: trimOrNull(formData.get("colorName")),
    colorHex: trimOrNull(formData.get("colorHex")),
    source: trimOrNull(formData.get("source")),
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key as CreateField] = issue.message;
    }
    return { fieldErrors };
  }

  const { images: imageList, sizeVariants: variants, ...rest } = parsed.data;

  if (!rest.hidden) {
    const reasons = publishBlockers({
      price: rest.price,
      images: JSON.stringify(imageList),
      sizeVariants: variants ? JSON.stringify(variants) : null,
    });
    if (reasons.length > 0) {
      return { fieldErrors: { hidden: `Kan niet direct zichtbaar: ${reasons.join(" en ")}. Maak het product eerst verborgen aan.` } };
    }
  }

  const existing = await prisma.product.findUnique({ where: { slug: rest.slug }, select: { id: true } });
  if (existing) return { fieldErrors: { slug: "Deze URL bestaat al, kies een andere" } };

  let created: { slug: string; category: string };
  try {
    created = await prisma.product.create({
      data: {
        ...rest,
        images: JSON.stringify(cleanImages(imageList)),
        sizeVariants: variants ? JSON.stringify(variants) : null,
      },
      select: { slug: true, category: true },
    });
  } catch (e) {
    logAdminError("createProduct", e, { slug: rest.slug });
    return { error: "Aanmaken mislukt. Probeer het opnieuw." };
  }

  revalidateProduct(created);
  redirect(`/admin/products/${created.slug}`);
}

// ─────────────────────────────────────────────────────────────────────
// Naar prullenbak (soft delete)
// ─────────────────────────────────────────────────────────────────────

export async function deleteProduct(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };
  if (typeof id !== "string" || !id) return { ok: false, error: "Ongeldige invoer" };

  let product: { slug: string; category: string };
  try {
    product = await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { slug: true, category: true },
    });
  } catch (e) {
    if (isNotFound(e)) return { ok: false, error: "Product niet gevonden" };
    logAdminError("deleteProduct", e, { id });
    return { ok: false, error: "Verwijderen mislukt. Probeer het opnieuw." };
  }

  revalidateProduct(product);
  revalidatePath("/admin/trash");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Eén foto naar de prullenbak (DeletedImage)
// ─────────────────────────────────────────────────────────────────────

const softDeleteImageSchema = z.object({
  productId: z.string().min(1),
  url: z.string().url(),
});

export async function softDeleteProductImage(
  input: z.infer<typeof softDeleteImageSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = softDeleteImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true, category: true, images: true },
  });
  if (!product) return { ok: false, error: "Product niet gevonden" };

  const imgs = parseAdminImages(product.images);
  const target = imgs.find((i) => i.url === parsed.data.url);
  if (!target) return { ok: false, error: "Foto niet gevonden bij dit product" };

  const publicId = extractPublicId(target.url);
  if (!publicId) return { ok: false, error: "Geen Cloudinary-foto; kan niet naar de prullenbak" };

  const remaining = imgs.filter((i) => i.url !== parsed.data.url);

  try {
    await prisma.$transaction([
      prisma.deletedImage.create({
        data: {
          productId: product.id,
          productSlug: product.slug,
          publicId,
          url: target.url,
          w: target.w ?? null,
          h: target.h ?? null,
        },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: { images: JSON.stringify(remaining) },
      }),
    ]);
  } catch (e) {
    logAdminError("softDeleteProductImage", e, { productId: product.id });
    return { ok: false, error: "Verplaatsen naar prullenbak mislukt" };
  }

  revalidateProduct(product);
  revalidatePath("/admin/trash");
  return { ok: true };
}
