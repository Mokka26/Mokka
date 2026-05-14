"use client";

interface Props {
  label?: string;
  number?: string;
  minHeight?: string;
}

export default function TypographicLoader({
  label = "Een ogenblik",
  number = "01",
  minHeight = "60vh",
}: Props) {
  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ minHeight }}
      role="status"
      aria-live="polite"
      aria-label="Inhoud wordt geladen"
    >
      <div className="text-center">
        <p className="eyebrow text-stone mb-6 typo-loader-fade">— {label}</p>
        <p
          className="font-serif italic text-ink leading-none typo-loader-fade"
          style={{
            fontSize: "clamp(4rem, 14vw, 11rem)",
            fontVariationSettings: '"opsz" 144',
            letterSpacing: "-0.04em",
          }}
        >
          {number}
        </p>
        <div className="mt-10 w-12 h-px bg-accent mx-auto typo-loader-line" />
      </div>
    </div>
  );
}
