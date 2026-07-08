"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { RotateCcw, X, AlertTriangle, Package, Image as ImageIcon } from "lucide-react";
import { cldOptimize } from "@/lib/cloudinary-url";
import {
  restoreProduct,
  permanentlyDeleteProduct,
  restoreImage,
  permanentlyDeleteImage,
  emptyTrash,
} from "./actions";
import { Trash2 } from "lucide-react";

type ProductItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  thumbnail: string | null;
  deletedAt: Date;
  autoPurgeAt: Date;
};

type ImageItem = {
  id: string;
  productSlug: string;
  productId: string | null;
  url: string;
  deletedAt: Date;
  autoPurgeAt: Date;
};

type Tab = "products" | "images";

export default function TrashClient({
  products,
  images,
}: {
  products: ProductItem[];
  images: ImageItem[];
  cutoff: string;
}) {
  const [tab, setTab] = useState<Tab>(products.length > 0 ? "products" : "images");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalItems = products.length + images.length;

  const handleEmptyTrash = () => {
    setError(null);
    startTransition(async () => {
      const r = await emptyTrash();
      if (!r.ok) setError(r.error);
      else setConfirmEmpty(false);
    });
  };

  const handleRestoreProduct = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await restoreProduct({ id });
      if (!r.ok) setError(r.error);
    });
  };

  const handlePermDeleteProduct = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await permanentlyDeleteProduct({ id });
      if (!r.ok) setError(r.error);
      else setConfirmId(null);
    });
  };

  const handleRestoreImage = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await restoreImage({ id });
      if (!r.ok) setError(r.error);
    });
  };

  const handlePermDeleteImage = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await permanentlyDeleteImage({ id });
      if (!r.ok) setError(r.error);
      else setConfirmId(null);
    });
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-line">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`flex items-center gap-2 px-4 py-3 text-[12px] uppercase tracking-[0.2em] transition-colors border-b-2 -mb-px ${
            tab === "products"
              ? "border-ink text-ink"
              : "border-transparent text-stone hover:text-ink"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Producten <span className="opacity-60 tabular-nums">({products.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("images")}
          className={`flex items-center gap-2 px-4 py-3 text-[12px] uppercase tracking-[0.2em] transition-colors border-b-2 -mb-px ${
            tab === "images"
              ? "border-ink text-ink"
              : "border-transparent text-stone hover:text-ink"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Foto&apos;s <span className="opacity-60 tabular-nums">({images.length})</span>
        </button>
        {totalItems > 0 && (
          <button
            type="button"
            onClick={() => setConfirmEmpty(true)}
            disabled={pending}
            className="ml-auto mb-2 inline-flex items-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Prullenbak leegmaken
          </button>
        )}
      </div>

      {confirmEmpty && (
        <ConfirmModal
          title="Hele prullenbak leegmaken?"
          body={`Alle ${products.length} producten en ${images.length} losse foto's worden definitief verwijderd — óók van Cloudinary. Dit kan niet ongedaan gemaakt worden. Foto's die nog door een actief product worden gebruikt blijven behouden.`}
          onCancel={() => setConfirmEmpty(false)}
          onConfirm={handleEmptyTrash}
          pending={pending}
        />
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-[12px] text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">×</button>
        </div>
      )}

      {tab === "products" && (
        <div>
          {products.length === 0 ? (
            <EmptyState label="Geen verwijderde producten" />
          ) : (
            <div className="space-y-2">
              {products.map((p) => {
                const daysLeft = Math.ceil(
                  (p.autoPurgeAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                );
                const isExpiring = daysLeft <= 3;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 bg-white border border-line p-3"
                  >
                    <div className="relative w-16 h-16 bg-bone flex-shrink-0 overflow-hidden">
                      {p.thumbnail && (
                        <Image
                          src={cldOptimize(p.thumbnail, { ar: "1:1", w: 200, mode: "fill" })}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-lg text-ink truncate">{p.name}</p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-stone mt-0.5">
                        {p.category} · €{p.price.toFixed(0)}
                      </p>
                      <p className={`text-[11px] mt-1 ${isExpiring ? "text-red-700" : "text-stone"}`}>
                        Verwijderd {formatDate(p.deletedAt)} · Permanent over {daysLeft} dagen
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreProduct(p.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-[0.2em] border border-line text-ink hover:bg-bone disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Herstel
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(p.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        Permanent
                      </button>
                    </div>

                    {confirmId === p.id && (
                      <ConfirmModal
                        title="Permanent verwijderen?"
                        body={`${p.name} en alle bijbehorende Cloudinary foto's worden definitief verwijderd. Dit kan niet ongedaan gemaakt worden.`}
                        onCancel={() => setConfirmId(null)}
                        onConfirm={() => handlePermDeleteProduct(p.id)}
                        pending={pending}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "images" && (
        <div>
          {images.length === 0 ? (
            <EmptyState label="Geen verwijderde foto's" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((img) => {
                const daysLeft = Math.ceil(
                  (img.autoPurgeAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                );
                const isExpiring = daysLeft <= 3;
                return (
                  <div key={img.id} className="relative bg-white border border-line">
                    <div className="relative aspect-square bg-bone overflow-hidden">
                      <Image
                        src={cldOptimize(img.url, { ar: "1:1", w: 400, mode: "fill" })}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] text-stone truncate">{img.productSlug}</p>
                      <p className={`text-[10px] mt-0.5 ${isExpiring ? "text-red-700" : "text-stone/70"}`}>
                        Over {daysLeft}d permanent weg
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => handleRestoreImage(img.id)}
                          disabled={pending || !img.productId}
                          title={img.productId ? "Herstel" : "Product weg"}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] border border-line text-ink hover:bg-bone disabled:opacity-30"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Herstel
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(img.id)}
                          disabled={pending}
                          className="inline-flex items-center justify-center px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                          title="Permanent verwijderen"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {confirmId === img.id && (
                      <ConfirmModal
                        title="Foto permanent verwijderen?"
                        body="De foto wordt definitief van Cloudinary verwijderd. Dit kan niet ongedaan gemaakt worden."
                        onCancel={() => setConfirmId(null)}
                        onConfirm={() => handlePermDeleteImage(img.id)}
                        pending={pending}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-stone">{label}</p>
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  onCancel,
  onConfirm,
  pending,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center px-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div className="bg-white border border-line max-w-md w-full p-8">
        <h3 className="font-serif text-2xl text-ink mb-3">{title}</h3>
        <p className="text-sm text-stone leading-relaxed mb-6">{body}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 px-6 py-3 text-[11px] uppercase tracking-[0.25em] border border-line text-ink hover:bg-bone disabled:opacity-60"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 px-6 py-3 text-[11px] uppercase tracking-[0.25em] bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
          >
            {pending ? "Verwijderen…" : "Definitief weg"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
