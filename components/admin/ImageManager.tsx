"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Trash2, Star, Upload, AlertCircle, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  getCloudinarySignature,
  updateProductImages,
  softDeleteProductImage,
} from "@/app/admin/(protected)/products/actions";
import type { AdminImage } from "@/app/admin/(protected)/_lib/images";

type Props = {
  productId?: string;
  category: string;
  slug: string;
  initialImages: AdminImage[];
  onChange?: (images: AdminImage[]) => void;
  /** false bij een nieuw product: alleen lokaal bijhouden, ouder slaat op. */
  persist?: boolean;
};

type Upload = { id: string; name: string; progress: number };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 100;
const PARALLEL_UPLOADS = 4;

/** Uniek id per upload (buiten de component: geen impure call in render). */
function makeUploadId(file: File): string {
  return `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

type CloudinaryUploadResponse = { secure_url: string; width: number; height: number };

function uploadWithProgress(url: string, form: FormData, onProgress: (pct: number) => void): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Cloudinary: ${xhr.status} ${xhr.responseText.slice(0, 120)}`));
        return;
      }
      try {
        const json: unknown = JSON.parse(xhr.responseText);
        const r = json as Partial<CloudinaryUploadResponse>;
        if (typeof r.secure_url !== "string") throw new Error("geen URL in antwoord");
        resolve({ secure_url: r.secure_url, width: Number(r.width) || 0, height: Number(r.height) || 0 });
      } catch (e) {
        reject(new Error(`Onleesbaar antwoord van Cloudinary (${e instanceof Error ? e.message : "?"})`));
      }
    };
    xhr.onerror = () => reject(new Error("Netwerkfout bij uploaden"));
    xhr.send(form);
  });
}

export default function ImageManager({ productId, category, slug, initialImages, onChange, persist = true }: Props) {
  const [images, setImages] = useState<AdminImage[]>(initialImages);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  // Altijd de nieuwste lijst, ook vanuit parallelle uploads (geen stale closure).
  const imagesRef = useRef<AdminImage[]>(initialImages);
  const savedRef = useRef<AdminImage[]>(initialImages);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);

  const canPersist = persist && !!productId;

  const applyLocal = (next: AdminImage[]) => {
    imagesRef.current = next;
    setImages(next);
    onChange?.(next);
  };

  /**
   * Slaat altijd de nieuwste snapshot op; opeenvolgende wijzigingen worden
   * geserialiseerd zodat een trager eerder verzoek nooit een nieuwere lijst
   * overschrijft. Bij een fout: toast + terug naar de laatst opgeslagen lijst.
   */
  const persistLatest = () => {
    if (!canPersist) return;
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const snapshot = imagesRef.current;
    void updateProductImages({ id: productId!, images: snapshot })
      .then((res) => {
        if (res.ok) {
          savedRef.current = snapshot;
          return;
        }
        toast.error(`Foto's niet opgeslagen: ${res.error}`);
        applyLocal(savedRef.current);
      })
      .catch(() => {
        toast.error("Foto's niet opgeslagen: verbinding mislukt");
        applyLocal(savedRef.current);
      })
      .finally(() => {
        savingRef.current = false;
        if (queuedRef.current) {
          queuedRef.current = false;
          persistLatest();
        } else {
          setSaving(false);
        }
      });
  };

  const update = (fn: (prev: AdminImage[]) => AdminImage[]) => {
    applyLocal(fn(imagesRef.current));
    persistLatest();
  };

  const move = (from: number, to: number) =>
    update((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const makePrimary = (i: number) => move(i, 0);

  const setAlt = (i: number, alt: string) =>
    applyLocal(imagesRef.current.map((img, idx) => (idx === i ? { ...img, alt } : img)));

  const removeAt = (i: number) => {
    const target = imagesRef.current[i];
    if (!target) return;
    setConfirmIndex(null);
    if (!canPersist) {
      update((prev) => prev.filter((_, idx) => idx !== i));
      return;
    }
    // Soft delete: server verplaatst de foto naar de prullenbak (30 dagen).
    const before = imagesRef.current;
    applyLocal(before.filter((img) => img.url !== target.url));
    void softDeleteProductImage({ productId: productId!, url: target.url }).then((res) => {
      if (res.ok) {
        savedRef.current = imagesRef.current;
        toast.success("Foto naar de prullenbak verplaatst");
        return;
      }
      toast.error(`Foto niet verwijderd: ${res.error}`);
      applyLocal(before);
    });
  };

  const uploadOne = async (file: File) => {
    const id = makeUploadId(file);
    setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
    try {
      if (file.size > MAX_SIZE) throw new Error(`${file.name}: bestand te groot (max 10 MB)`);
      const sig = await getCloudinarySignature(`mokka/${category}/${slug}`);
      if (!sig.ok) throw new Error(sig.error);

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("public_id", sig.publicId);
      form.append("folder", sig.folder);
      form.append("allowed_formats", sig.allowedFormats);

      const json = await uploadWithProgress(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        form,
        (pct) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: pct } : x))),
      );
      update((prev) => [...prev, { url: json.secure_url, w: json.width, h: json.height }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload mislukt";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploads((u) => u.filter((x) => x.id !== id));
    }
  };

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const room = MAX_IMAGES - imagesRef.current.length;
    if (room <= 0) {
      toast.error(`Maximaal ${MAX_IMAGES} foto's per product`);
      return;
    }
    const batch = files.slice(0, room);
    if (batch.length < files.length) toast.warning(`Alleen de eerste ${batch.length} foto's worden geüpload (max ${MAX_IMAGES}).`);
    setError(null);
    // Parallel, in groepjes, zodat de browser niet verstopt raakt.
    for (let i = 0; i < batch.length; i += PARALLEL_UPLOADS) {
      await Promise.all(batch.slice(i, i + PARALLEL_UPLOADS).map(uploadOne));
    }
  };

  const busy = uploads.length > 0;

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 px-3 py-2 bg-error/10 border border-error/30 text-sm text-error">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Melding sluiten"
            className="inline-flex items-center justify-center w-11 h-11 -my-2 -mr-2 text-error hover:bg-error/10"
          >
            ×
          </button>
        </div>
      )}

      {(busy || saving) && (
        <p role="status" aria-live="polite" className="mb-3 text-sm text-stone">
          {busy ? `${uploads.length} foto${uploads.length === 1 ? "" : "'s"} aan het uploaden…` : "Opslaan…"}
        </p>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {images.map((img, i) => (
          <ImageTile
            key={img.url}
            id={`${baseId}-${i}`}
            image={img}
            index={i}
            total={images.length}
            confirming={confirmIndex === i}
            dragging={dragIndex === i}
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => setDragIndex(null)}
            onDrop={() => {
              if (dragIndex != null) move(dragIndex, i);
              setDragIndex(null);
            }}
            onMoveLeft={() => move(i, i - 1)}
            onMoveRight={() => move(i, i + 1)}
            onMakePrimary={() => makePrimary(i)}
            onAskRemove={() => setConfirmIndex(i)}
            onCancelRemove={() => setConfirmIndex(null)}
            onConfirmRemove={() => removeAt(i)}
            onAltChange={(alt) => setAlt(i, alt)}
            onAltBlur={() => {
              if (imagesRef.current !== savedRef.current) persistLatest();
            }}
          />
        ))}

        {uploads.map((u) => (
          <li key={u.id} className="border border-line bg-white">
            <div className="aspect-square bg-bone flex flex-col items-center justify-center gap-3 px-4">
              <span className="eyebrow-lg">Uploaden…</span>
              <progress
                value={u.progress}
                max={100}
                aria-label={`Upload van ${u.name}: ${u.progress}%`}
                className="w-full h-2 accent-accent"
              />
              <span className="text-sm text-stone tabular-nums">{u.progress}%</span>
            </div>
            <p className="px-3 py-2 text-sm text-stone truncate">{u.name}</p>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-square bg-white border-2 border-dashed border-line hover:border-accent hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors flex flex-col items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5 text-stone" aria-hidden="true" />
            <span className="eyebrow-lg">Foto&rsquo;s toevoegen</span>
            <span className="text-sm text-stone">JPG, PNG, WebP of AVIF · max 10 MB</span>
          </button>
        </li>
      </ul>

      <input ref={fileRef} type="file" accept={ACCEPT} multiple onChange={onSelect} className="hidden" aria-hidden="true" tabIndex={-1} />

      {images.length === 0 && uploads.length === 0 && (
        <p className="text-base text-stone mt-4">Nog geen foto&rsquo;s. De eerste foto wordt automatisch de hoofdfoto.</p>
      )}
    </div>
  );
}

function ImageTile({
  id,
  image,
  index,
  total,
  confirming,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onMoveLeft,
  onMoveRight,
  onMakePrimary,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
  onAltChange,
  onAltBlur,
}: {
  id: string;
  image: AdminImage;
  index: number;
  total: number;
  confirming: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onMakePrimary: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onAltChange: (alt: string) => void;
  onAltBlur: () => void;
}) {
  const isPrimary = index === 0;
  const iconBtn =
    "inline-flex items-center justify-center w-11 h-11 text-stone hover:text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 transition-colors";
  const altId = `${id}-alt`;

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`bg-white border border-line ${dragging ? "opacity-50" : ""}`}
      aria-label={`Foto ${index + 1} van ${total}${isPrimary ? " (hoofdfoto)" : ""}`}
    >
      <div className="relative aspect-square bg-bone overflow-hidden">
        <Image
          src={image.url}
          alt={image.alt ?? ""}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
        {isPrimary && (
          <span className="badge absolute top-2 left-2">
            Hoofdfoto
          </span>
        )}
        <span className="absolute top-2 right-2 bg-white/90 text-stone p-1" aria-hidden="true" title="Sleep om te verplaatsen">
          <GripVertical className="w-4 h-4" />
        </span>
      </div>

      {confirming ? (
        <div className="p-3 border-t border-line">
          <p className="text-sm text-ink mb-2">Foto naar de prullenbak? Je kunt hem 30 dagen herstellen.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelRemove}
              className="flex-1 min-h-11 text-sm uppercase tracking-[0.1em] border border-line text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={onConfirmRemove}
              className="flex-1 min-h-11 text-sm uppercase tracking-[0.1em] bg-error text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
            >
              Verwijderen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center border-t border-line">
          <button type="button" onClick={onMakePrimary} disabled={isPrimary} aria-label="Maak hoofdfoto" title="Maak hoofdfoto" className={iconBtn}>
            <Star className={`w-4 h-4 ${isPrimary ? "fill-accent text-accent" : ""}`} />
          </button>
          <button type="button" onClick={onMoveLeft} disabled={index === 0} aria-label="Eerder in de volgorde" title="Eerder" className={iconBtn}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={index === total - 1}
            aria-label="Later in de volgorde"
            title="Later"
            className={iconBtn}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onAskRemove}
            aria-label="Foto naar prullenbak"
            title="Naar prullenbak"
            className={`${iconBtn} ml-auto hover:text-error hover:bg-error/10`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-3 border-t border-line">
        <label htmlFor={altId} className="block eyebrow-lg mb-1.5">
          Alt-tekst
        </label>
        <input
          id={altId}
          value={image.alt ?? ""}
          onChange={(e) => onAltChange(e.target.value)}
          onBlur={onAltBlur}
          maxLength={200}
          placeholder="Bijv. Hoekbank Lucce in bruin, vooraanzicht"
          className="w-full min-h-11 px-3 py-2 bg-bone border border-line-strong text-ink text-base focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
    </li>
  );
}
