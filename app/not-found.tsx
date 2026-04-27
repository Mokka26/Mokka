import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[90vh] flex items-center justify-center px-6 sm:px-10 lg:px-14 pt-32 pb-20">
      <div className="max-w-[1600px] w-full mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <p className="font-serif text-[clamp(8rem,22vw,18rem)] leading-none text-bronze/30 mb-2 select-none">
            404
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="w-10 h-[1px] bg-line" />
            <span className="eyebrow">Foutmelding</span>
            <span className="w-10 h-[1px] bg-line" />
          </div>
          <h1 className="display-xl text-ink mb-8">
            Pagina niet <span className="italic text-stone/80">gevonden</span>
          </h1>
          <p className="body-lg text-slate mb-12 max-w-md mx-auto">
            De pagina die je zoekt bestaat niet of is verplaatst.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="btn-primary text-center">Naar Home</Link>
            <Link href="/products" className="btn-ghost text-center">Bekijk Collectie</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
