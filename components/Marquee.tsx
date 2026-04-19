"use client";

interface Props {
  items: string[];
  className?: string;
}

export default function Marquee({ items, className = "" }: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items, ...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-8 mx-8 flex-shrink-0">
            <span className="font-serif italic text-[13vw] leading-none text-ink/90">{item}</span>
            <span className="text-bronze text-5xl">—</span>
          </span>
        ))}
      </div>
    </div>
  );
}
