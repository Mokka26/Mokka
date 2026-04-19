"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface Props {
  number: string;
  label: string;
  title: string;
  titleItalic?: string;
  linkHref?: string;
  linkLabel?: string;
}

export default function SectionHeader({ number, label, title, titleItalic, linkHref, linkLabel }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end"
    >
      <div className="lg:col-span-8">
        <div className="flex items-center gap-4 mb-5">
          <span className="font-serif italic text-stone text-sm">— {number}</span>
          <span className="eyebrow">{label}</span>
        </div>
        <h2 className="display-lg text-ink leading-[1.05]">
          {title}
          {titleItalic && <> <span className="italic text-stone/80">{titleItalic}</span></>}
        </h2>
      </div>
      {linkHref && linkLabel && (
        <div className="lg:col-span-4 lg:text-right">
          <Link
            href={linkHref}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-ink border-b border-ink pb-1 hover:gap-3 transition-all group"
          >
            {linkLabel}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
