import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Props {
  number: string;
  label: string;
  title: string;
  titleItalic?: string;
  linkHref?: string;
  linkLabel?: string;
}

// Server component: geen framer-motion, geen opacity-0 in de server-HTML.
export default function SectionHeader({ number, label, title, titleItalic, linkHref, linkLabel }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
      <div className="lg:col-span-8">
        <div className="flex items-center gap-4 mb-5">
          <span className="font-serif italic text-stone text-sm">— {number}</span>
          <span className="text-sm font-medium uppercase tracking-[0.14em] text-stone">{label}</span>
        </div>
        <h2 className="display-lg text-ink leading-[1.05]">
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
