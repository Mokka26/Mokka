"use client";

import Link from "next/link";
import Image from "next/image";

interface Props {
  name: string;
  slug: string;
  image: string;
  description: string;
  tall?: boolean;
}

export default function CategoryCard({ name, slug, image, description, tall }: Props) {
  return (
    <Link href={`/products?category=${slug}`} className="group relative block overflow-hidden">
      <div className={`relative ${tall ? "aspect-[3/4] lg:aspect-[4/5]" : "aspect-[4/3] sm:aspect-square"}`}>
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 40vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/5 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
          <p className="text-white/40 text-[9px] sm:text-[10px] uppercase tracking-[0.3em] mb-1">{description}</p>
          <div className="flex items-end justify-between">
            <h3 className={`font-serif text-white ${tall ? "text-2xl sm:text-3xl lg:text-4xl" : "text-xl sm:text-2xl"}`}>{name}</h3>
            <svg className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
