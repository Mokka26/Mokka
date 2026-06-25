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
// Inline updates (price, featured, stock, hidden)
// ─────────────────────────────────────────────────────────────────────

const inlineUpdateSchema = z.object({
  id: z.string().min(1),
  price: z.number().nonnegative().max(999999).optional(),
  featured: z.boolean().optional(),
  stock: z.number().int().nonnegative().max(99999).optional(),
  hidden: z.boolean().optional(),
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
    // Prijswijziging werkt door op alle kleuren van hetzelfde model.
    if (data.price !== undefined) {
      const prod = await prisma.product.findUnique({ where: { id }, select: { colorGroup: true } });
      if (prod?.colorGroup) {
        await prisma.product.updateMany({
          where: { colorGroup: prod.colorGroup, deletedAt: null },
          data: { price: data.price },
        });
      }
    }
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

// Maat-varianten (bv. bedden): label + verkoopprijs + optionele adviesprijs.
// Leeg → null (product heeft één prijs).
// label is verplicht; price/listPrice zijn optionele overrides. Een maat
// zonder price gebruikt de product-verkoopprijs (en advies de product-advies).
const sizeVariantsSchema = z
  .array(
    z.object({
      label: z.string().min(1).max(40),
      price: z.number().nonnegative().max(999999).optional(),
      listPrice: z.number().nonnegative().max(999999).optional(),
    }),
  )
  .max(12)
  .nullable();

type ParsedSizeVariant = { label: string; price?: number; listPrice?: number };

function parseSizeVariants(raw: FormDataEntryValue | null): ParsedSizeVariant[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const out: ParsedSizeVariant[] = [];
    for (const it of arr) {
      const label = typeof it?.label === "string" ? it.label.trim() : "";
      if (!label) continue;
      const variant: ParsedSizeVariant = { label };
      const price = typeof it?.price === "number" ? it.price : Number(it?.price);
      if (Number.isFinite(price) && price > 0) variant.price = price;
      const lp = typeof it?.listPrice === "number" ? it.listPrice : Number(it?.listPrice);
      // Adviesprijs alleen als die hoger is dan de (eventuele) maat-verkoopprijs.
      if (Number.isFinite(lp) && lp > (variant.price ?? 0)) variant.listPrice = lp;
      out.push(variant);
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

// Adviesprijs op productniveau: leeg of ≤ verkoopprijs → null (geen korting).
function parseListPrice(raw: FormDataEntryValue | null, price: number): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > price ? n : null;
}

const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bijv. #8B6F47").nullable();

const fullUpdateSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, "Alleen kleine letters, cijfers en streepjes"),
  name: z.string().min(2).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().nonnegative().max(999999),
  listPrice: z.number().nonnegative().max(999999).nullable(),
  category: z.string().min(1).max(50),
  featured: z.boolean(),
  hidden: z.boolean(),
  specs: specsRecordSchema.nullable(),
  sizeVariants: sizeVariantsSchema,
  stock: z.number().int().nonnegative().max(99999),
  deliveryTime: z.string().max(80).nullable(),
  colorGroup: z.string().max(80).nullable(),
  colorName: z.string().max(40).nullable(),
  colorHex: hexSchema,
  source: z.string().max(60).nullable(),
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
    slug: slugify(String(formData.get("slug") || "")),
    name: formData.get("name"),
    description: formData.get("description"),
    price: Number(formData.get("price")),
    listPrice: parseListPrice(formData.get("listPrice"), Number(formData.get("price"))),
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
    hidden: formData.get("hidden") === "on",
    specs: specsParsed,
    sizeVariants: parseSizeVariants(formData.get("sizeVariants")),
    stock: Number(formData.get("stock") ?? 0),
    deliveryTime: trimOrNull(formData.get("deliveryTime")),
    colorGroup: trimOrNull(formData.get("colorGroup")),
    colorName: trimOrNull(formData.get("colorName")),
    colorHex: trimOrNull(formData.get("colorHex")),
    source: trimOrNull(formData.get("source")),
  });

  if (!parsed.success) {
    const fieldErrors: FullUpdateState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof fullUpdateSchema>;
      fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { id, specs, sizeVariants, ...rest } = parsed.data;

  // Is de slug (URL) gewijzigd?
  const existing = await prisma.product.findUnique({ where: { id }, select: { slug: true } });
  const slugChanged = Boolean(existing && existing.slug !== rest.slug);

  // Slug-uniciteit: bij een gewijzigde slug mag geen ander product 'm al hebben.
  if (slugChanged) {
    const clash = await prisma.product.findUnique({ where: { slug: rest.slug }, select: { id: true } });
    if (clash) {
      return { fieldErrors: { slug: "Deze URL is al in gebruik door een ander product" } };
    }
  }

  let updated;
  try {
    updated = await prisma.product.update({
      where: { id },
      data: {
        ...rest,
        specs: specs ? JSON.stringify(specs) : null,
        sizeVariants: sizeVariants ? JSON.stringify(sizeVariants) : null,
      },
    });
  } catch {
    return { error: "Update mislukt" };
  }

  // Prijs én adviesprijs werken door op alle kleuren van hetzelfde model.
  if (updated.colorGroup) {
    await prisma.product.updateMany({
      where: { colorGroup: updated.colorGroup, deletedAt: null },
      data: { price: rest.price, listPrice: rest.listPrice },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath(`/products/${updated.slug}`);
  if (existing && existing.slug !== updated.slug) revalidatePath(`/products/${existing.slug}`);
  revalidatePath(`/${updated.category}`);
  revalidatePath(`/${updated.category}/${updated.slug}`);

  // Slug gewijzigd → admin-bewerk-URL is verplaatst; redirect naar de nieuwe.
  if (slugChanged) redirect(`/admin/products/${updated.slug}`);
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
  revalidatePath(`/${updated.category}`);
  revalidatePath(`/${updated.category}/${updated.slug}`);
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
  listPrice: z.number().nonnegative().max(999999).nullable().default(null),
  category: z.string().min(1).max(50),
  featured: z.boolean(),
  images: z.array(productImageSchema).default([]),
  sizeVariants: sizeVariantsSchema.default(null),
  stock: z.number().int().nonnegative().max(99999).default(10),
  deliveryTime: z.string().max(80).nullable().default(null),
  colorGroup: z.string().max(80).nullable().default(null),
  colorName: z.string().max(40).nullable().default(null),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bijv. #8B6F47").nullable().default(null),
  source: z.string().max(60).nullable().default(null),
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
    listPrice: parseListPrice(formData.get("listPrice"), Number(formData.get("price"))),
    category: formData.get("category"),
    featured: formData.get("featured") === "on",
    images,
    sizeVariants: parseSizeVariants(formData.get("sizeVariants")),
    stock: Number(formData.get("stock") ?? 10),
    deliveryTime: trimOrNull(formData.get("deliveryTime")),
    colorGroup: trimOrNull(formData.get("colorGroup")),
    colorName: trimOrNull(formData.get("colorName")),
    colorHex: trimOrNull(formData.get("colorHex")),
    source: trimOrNull(formData.get("source")),
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

  const { images: imageList, sizeVariants, ...rest } = parsed.data;
  const created = await prisma.product.create({
    data: {
      ...rest,
      images: JSON.stringify(imageList),
      sizeVariants: sizeVariants ? JSON.stringify(sizeVariants) : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect(`/admin/products/${created.slug}`);
}

// ─────────────────────────────────────────────────────────────────────
// Soft-delete product (verplaatst naar prullenbak, niet uit DB verwijderd)
// ─────────────────────────────────────────────────────────────────────

export async function deleteProduct(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Niet ingelogd" };

  try {
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { ok: false, error: "Verwijderen mislukt" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/trash");
  revalidatePath("/products");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Soft-delete één foto van een product (verplaatst naar DeletedImage)
// ─────────────────────────────────────────────────────────────────────

import { extractPublicId } from "@/lib/cloudinary-helpers";

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

  // Parse images, vind de juiste, verwijder hem en push naar DeletedImage
  let imgs: { url: string; w?: number; h?: number }[] = [];
  try {
    const raw = JSON.parse(product.images);
    if (Array.isArray(raw)) {
      imgs = raw.map((item) =>
        typeof item === "string"
          ? { url: item }
          : { url: item.url, w: item.w, h: item.h },
      );
    }
  } catch {
    return { ok: false, error: "Kan foto's niet parsen" };
  }

  const target = imgs.find((i) => i.url === parsed.data.url);
  if (!target) return { ok: false, error: "Foto niet gevonden in product" };

  const publicId = extractPublicId(target.url);
  if (!publicId) return { ok: false, error: "Ongeldige Cloudinary URL" };

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
  } catch {
    return { ok: false, error: "Verplaatsen naar prullenbak mislukt" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/trash");
  revalidatePath(`/products/${product.slug}`);
  revalidatePath(`/${product.category}`);
  revalidatePath(`/${product.category}/${product.slug}`);
  return { ok: true };
}
