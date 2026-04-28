"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Trash2, Star, Upload, AlertCircle } from "lucide-react";
import {
  getCloudinarySignature,
  updateProductImages,
} from "@/app/admin/(protected)/products/actions";
import type { ProductImage } from "@/lib/imageHelpers";

type Props = {
  productId?: string;
  category: string;
  slug: string;
  initialImages: ProductImage[];
  onChange?: (images: ProductImage[]) => void;
  persist?: boolean;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_SIZE = 10 * 1024 * 1024;

export default function ImageManager({
  productId,
  category,
  slug,
  initialImages,
  onChange,
  persist = true,
}: Props) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = (next: ProductImage[]) => {
    setImages(next);
    onChange?.(next);
    if (!persist || !productId) return;
    startTransition(async () => {
      const res = await updateProductImages({ id: productId, images: next });
      if (!res.ok) {
        setError(res.error);
        setImages(images);
      }
    });
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...images];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    commit(next);
  };

  const moveDown = (i: number) => {
    if (i === images.length - 1) return;
    const next = [...images];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    commit(next);
  };

  const makePrimary = (i: number) => {
    if (i === 0) return;
    const next = [...images];
    const [moved] = next.splice(i, 1);
    next.unshift(moved);
    commit(next);
  };

  const removeAt = (i: number) => {
    if (!confirm("Foto verwijderen? Het bestand blijft op Cloudinary staan.")) return;
    const next = images.filter((_, idx) => idx !== i);
    commit(next);
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      setError("Bestand te groot (max 10 MB)");
      return;
    }
    setError(null);

    const tempId = `${file.name}-${Date.now()}`;
    setUploading((u) => [...u, tempId]);

    try {
      const folder = `mokka/${category}/${slug}`;
      const sig = await getCloudinarySignature(folder);
      if (!sig.ok) throw new Error(sig.error);

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("public_id", sig.publicId);
      form.append("folder", sig.folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: form },
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cloudinary: ${res.status} ${errText.slice(0, 100)}`);
      }
      const json = (await res.json()) as {
        secure_url: string;
        width: number;
        height: number;
      };
      commit([
        ...images,
        { url: json.secure_url, w: json.width, h: json.height },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload mislukt");
    } finally {
      setUploading((u) => u.filter((id) => id !== tempId));
    }
  };

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) await handleFile(f);
  };

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-[12px] text-red-700">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto text-red-700/60 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((img, i) => (
          <ImageTile
            key={img.url}
            url={img.url}
            index={i}
            isPrimary={i === 0}
            isFirst={i === 0}
            isLast={i === images.length - 1}
            disabled={pending}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
            onMakePrimary={() => makePrimary(i)}
            onRemove={() => removeAt(i)}
          />
        ))}

        {uploading.map((id) => (
          <div
            key={id}
            className="aspect-square bg-bone border border-line flex items-center justify-center"
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-stone animate-pulse">
              Uploaden…
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="aspect-square bg-white border-2 border-dashed border-line hover:border-bronze hover:bg-bone transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
        >
          <Upload className="w-5 h-5 text-stone" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-stone">
            Foto toevoegen
          </span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={onSelect}
        className="hidden"
      />

      {images.length === 0 && uploading.length === 0 && (
        <p className="text-[12px] text-stone mt-4">Nog geen foto&rsquo;s. De eerste foto wordt automatisch de hoofdfoto.</p>
      )}
    </div>
  );
}

function ImageTile({
  url,
  isPrimary,
  isFirst,
  isLast,
  disabled,
  onMoveUp,
  onMoveDown,
  onMakePrimary,
  onRemove,
}: {
  url: string;
  index: number;
  isPrimary: boolean;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMakePrimary: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative aspect-square bg-bone border border-line group overflow-hidden">
      <Image
        src={url}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
      />

      {isPrimary && (
        <div className="absolute top-2 left-2 bg-ink text-white text-[9px] uppercase tracking-[0.25em] px-2 py-1">
          Hoofdfoto
        </div>
      )}

      <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/40 transition-colors flex flex-col justify-end opacity-0 group-hover:opacity-100">
        <div className="flex items-center gap-1 p-2 bg-white/95 border-t border-line">
          {!isPrimary && (
            <button
              type="button"
              onClick={onMakePrimary}
              disabled={disabled}
              title="Maak hoofdfoto"
              className="p-1.5 hover:bg-bone disabled:opacity-50"
            >
              <Star className="w-3.5 h-3.5 text-stone" />
            </button>
          )}
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || isFirst}
            title="Naar links"
            className="p-1.5 hover:bg-bone disabled:opacity-30"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-stone" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || isLast}
            title="Naar rechts"
            className="p-1.5 hover:bg-bone disabled:opacity-30"
          >
            <ArrowRight className="w-3.5 h-3.5 text-stone" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            title="Verwijder"
            className="p-1.5 hover:bg-red-50 ml-auto disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-700" />
          </button>
        </div>
      </div>
    </div>
  );
}
