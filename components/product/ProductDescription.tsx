"use client";

import { useId, useState } from "react";

interface Props {
  name: string;
  description: string;
}

const PREVIEW_CHARS = 320;

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Knipt op een zinseinde ná PREVIEW_CHARS — nooit midden in een zin. Geeft
 * [preview, rest]; rest is leeg als de tekst kort genoeg is.
 */
function splitAtSentence(text: string): [string, string] {
  if (text.length <= PREVIEW_CHARS * 1.4) return [text, ""];
  const m = /[.!?](\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = m.exec(text)) !== null) {
    const end = match.index + 1;
    if (end >= PREVIEW_CHARS) return [text.slice(0, end).trim(), text.slice(end).trim()];
  }
  return [text, ""];
}

/**
 * "Over dit product" (productnaam alleen voor screenreaders) — volledige
 * beschrijving, met een toegankelijke
 * "Lees meer" (aria-expanded/aria-controls) als de tekst lang is. Het
 * verborgen deel staat wél in de HTML (SEO), maar is voor iedereen verborgen
 * tot de knop is ingedrukt.
 */
export function ProductDescription({ name, description }: Props) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const text = description.trim();
  if (!text) return null;

  const paragraphs = splitParagraphs(text);
  let preview: string[];
  let rest: string[];
  if (paragraphs.length > 1) {
    preview = [paragraphs[0]];
    rest = paragraphs.slice(1);
  } else {
    const [a, b] = splitAtSentence(paragraphs[0]);
    preview = [a];
    rest = b ? [b] : [];
  }
  const hasMore = rest.length > 0;
  const restId = `${id}-more`;

  return (
    <section className="mt-24 lg:mt-36 bg-bone/40 py-16 lg:py-28" aria-labelledby={`${id}-title`}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-4">
            <h2 id={`${id}-title`} className="font-serif text-3xl lg:text-4xl text-ink leading-[1.1] mb-6">
              Over dit product
              <span className="sr-only">: {name}</span>
            </h2>
            <div className="w-10 h-px bg-accent" aria-hidden="true" />
          </div>
          <div className="lg:col-span-8">
            <div className="space-y-6">
              {preview.map((p, i) => (
                <p
                  key={`p-${i}`}
                  className={
                    i === 0
                      ? "font-serif text-xl lg:text-2xl text-ink leading-relaxed"
                      : "text-base lg:text-lg text-graphite leading-relaxed"
                  }
                >
                  {p}
                </p>
              ))}
            </div>
            {hasMore && (
              <>
                <div id={restId} hidden={!expanded} className="space-y-6 mt-6">
                  {rest.map((p, i) => (
                    <p key={`r-${i}`} className="text-base lg:text-lg text-graphite leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-controls={restId}
                  className="mt-6 inline-flex items-center min-h-11 text-base text-ink underline underline-offset-4 hover:text-accent transition-colors"
                >
                  {expanded ? "Lees minder" : "Lees meer"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
