import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 pt-24">
      <div className="text-center max-w-md">
        <p className="text-8xl font-serif text-bone mb-6">404</p>
        <h1 className="text-2xl font-serif text-ink mb-3">Pagina Niet Gevonden</h1>
        <p className="text-stone mb-8">
          De pagina die je zoekt bestaat niet of is verplaatst.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/" className="btn-primary text-center">Naar Home</Link>
          <Link href="/products" className="btn-ghost text-center">Bekijk Collectie</Link>
        </div>
      </div>
    </div>
  );
}
