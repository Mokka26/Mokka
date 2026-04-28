"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─────────────────────────────────────────────────────────────────────
// Inline updates (price, featured)
// ─────────────────────────────────────────────────────────────────────

const inlineUpdateSchema = z.object({
  id: z.string().min(1),
  price: z.number().nonnegative().max(999999).optional(),
  featured: z.boolean().optional(),
  stock: z.number().int().nonnegative().max(99999).optional(),
});

export type InlineUpdateInput = z.infer<typeof inlineUpdateSchema>;
export type InlineUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateProductInline(
  input: InlineUpdateInput,
): Promise<InlineUpdateResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = inlineUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { id, ...data } = parsed.data;
  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await prisma.product.update({ where: { id }, data });
  } catch {
    return { ok: false, error: "Update mislukt" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Full edit (name, description, price, category, featured)
// ─────────────────────────────────────────────────────────────────────

const specsRecordSchema = z
  .record(z.string().min(1).max(50), z.string().min(1).max(200))
  .refine((r) => Object.keys(r).length <= 20, { message: "Max 20 specs" });

const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bijv. #8B6F47").nullable();

const fullUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().nonnegative().max(999999),
  category: z.string().min(1).max(50),
  featured: z.boolean(),
  specs: specsRecordSchema.nullable(),
  stock: z.number().int().nonnegative().max(99999),
  deliveryTime: z.string().max(80).nullable(),
  colorGroup: z.string().max(80).nullable(),
  colorName: z.string().max(40).nullable(),
  colorHex: hexSchema,
});

export type FullUpdateState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof fullUpdateSchema>, string>>;
};

export async function updateProductFull(
  _prev: FullUpdateState,
  formData: FormData,
): Promise<FullUpdateState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };

  const rawSpecs = formData.get("specs");
  let specsParsed: Record<string, string> | null = null;
  if (typeof rawSpecs === "string" && rawSpecs.trim()) {
    try {
      const obj = JSON.parse(rawSpecs);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const filtered: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
            filtered[k.trim()] = v.trim();
          }
        }
        specsParsed = Object.keys(filtered).length > 0 ? filtered : null;
      }
    } catch {
      specsParsed = null;
    }
  }

  const trimOrNull = (v: FormDataEntryValue | null): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  const parsed = fullUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: Number(formData.get("price")),
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
    specs: specsParsed,
    stock: Number(formData.get("stock") ?? 0),
    deliveryTime: trimOrNull(formData.get("deliveryTime")),
    colorGroup: trimOrNull(formData.get("colorGroup")),
    colorName: trimOrNull(formData.get("colorName")),
    colorHex: trimOrNull(formData.get("colorHex")),
  });

  if (!parsed.success) {
    const fieldErrors: FullUpdateState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof fullUpdateSchema>;
      fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { id, specs, ...rest } = parsed.data;

  let updated;
  try {
    updated = await prisma.product.update({
      where: { id },
      data: { ...rest, specs: specs ? JSON.stringify(specs) : null },
    });
  } catch {
    return { error: "Update mislukt" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath(`/products/${updated.slug}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Image management
// ─────────────────────────────────────────────────────────────────────

const productImageSchema = z.object({
  url: z.string().url(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
});

const imagesUpdateSchema = z.object({
  id: z.string().min(1),
  images: z.array(productImageSchema).max(20),
});

export async function updateProductImages(
  input: z.infer<typeof imagesUpdateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  const parsed = imagesUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  let updated;
  try {
    updated = await prisma.product.update({
      where: { id: parsed.data.id },
      data: { images: JSON.stringify(parsed.data.images) },
    });
  } catch {
    return { ok: false, error: "Opslaan mislukt" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath(`/products/${updated.slug}`);
  return { ok: true };
}

export async function getCloudinarySignature(
  folder: string,
): Promise<
  | { ok: true; signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string; publicId: string }
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
    { folder: safeFolder, public_id: publicId, timestamp },
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
  };
}

// ─────────────────────────────────────────────────────────────────────
// Create product
// ─────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en streepjes"),
  description: z.string().min(1).max(5000),
  price: z.number().nonnegative().max(999999),
  category: z.string().min(1).max(50),
  featured: z.boolean(),
  images: z.array(productImageSchema).default([]),
  stock: z.number().int().nonnegative().max(99999).default(10),
  deliveryTime: z.string().max(80).nullable().default(null),
  colorGroup: z.string().max(80).nullable().default(null),
  colorName: z.string().max(40).nullable().default(null),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bijv. #8B6F47").nullable().default(null),
});

export type CreateProductState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof createSchema>, string>>;
};

export async function createProduct(
  _prev: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const session = await auth();
  if (!session?.user) return { error: "Niet ingelogd" };

  const rawImages = formData.get("images");
  let images: string[] = [];
  try {
    images = rawImages ? JSON.parse(String(rawImages)) : [];
  } catch {
    images = [];
  }

  const trimOrNull = (v: FormDataEntryValue | null): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    description: formData.get("description"),
    price: Number(formData.get("price")),
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
    images,
    stock: Number(formData.get("stock") ?? 10),
    deliveryTime: trimOrNull(formData.get("deliveryTime")),
    colorGroup: trimOrNull(formData.get("colorGroup")),
    colorName: trimOrNull(formData.get("colorName")),
    colorHex: trimOrNull(formData.get("colorHex")),
  });

  if (!parsed.success) {
    const fieldErrors: CreateProductState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof createSchema>;
      fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const existing = await prisma.product.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { fieldErrors: { slug: "Slug bestaat al, kies een andere" } };
  }

  const { images: imageList, ...rest } = parsed.data;
  const created = await prisma.product.create({
    data: { ...rest, images: JSON.stringify(imageList) },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect(`/admin/products/${created.slug}`);
}

// ─────────────────────────────────────────────────────────────────────
// Delete product
// ─────────────────────────────────────────────────────────────────────

export async function deleteProduct(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Verwijderen mislukt" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true };
}
