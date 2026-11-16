import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Props {
  /**
   * Sectienummer ("01"). Alleen gebruiken als de pagina minstens twee
   * genummerde secties heeft; een los nummer zegt niets.
   */
  number?: string;
  /** Kleine label-tekst boven de kop (optioneel). */
  label?: string;
  title: string;
  titleItalic?: string;
  /** id op de h2, voor aria-labelledby op de omringende <section>. */
  id?: string;
  linkHref?: string;
  linkLabel?: string;
}

// Server component: geen framer-motion, geen opacity-0 in de server-HTML.
export default function SectionHeader({ number, label, title, titleItalic, id, linkHref, linkLabel }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
      <div className="lg:col-span-8">
        {(number || label) && (
          <div className="flex items-center gap-4 mb-5">
            {number && <span className="font-serif italic text-stone text-sm">— {number}</span>}
            {label && <span className="text-sm font-medium uppercase tracking-label text-stone">{label}</span>}
          </div>
        )}
        <h2 id={id} className="display-lg text-ink leading-[1.05]">
          {title}
          {titleItalic && <> <span className="italic text-slate">{titleItalic}</span></>}
        </h2>
      </div>
      {linkHref && linkLabel && (
        <div className="lg:col-span-4 lg:text-right">
          <Link href={linkHref} className="btn-link text-sm">
            {linkLabel}
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}
