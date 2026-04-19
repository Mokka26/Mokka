import { Suspense } from "react";
import ProductsContent from "./ProductsContent";

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="pt-28 lg:pt-32 pb-20">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-14 lg:mb-20">
          <div className="h-3 w-24 bg-bone animate-shimmer mb-4" />
          <div className="h-12 w-72 bg-bone animate-shimmer" />
        </div>
        <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14">
          <div className="h-14 bg-bone animate-shimmer mb-10 lg:mb-14" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-6 sm:gap-y-16">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[4/5] bg-bone animate-shimmer" />
                <div className="h-3 w-3/4 bg-bone animate-shimmer" />
                <div className="h-3 w-1/3 bg-bone animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
