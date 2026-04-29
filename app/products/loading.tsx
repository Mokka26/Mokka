export default function Loading() {
  return (
    <div className="pt-32 lg:pt-40 pb-28 lg:pb-40">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 mb-16 lg:mb-24">
        <div className="h-3 w-24 bg-bone animate-shimmer mb-5" />
        <div className="h-12 w-64 bg-bone animate-shimmer" />
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-12 sm:gap-x-4 sm:gap-y-14">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="aspect-square bg-white animate-shimmer" />
              <div className="h-3 w-3/4 bg-bone animate-shimmer" />
              <div className="h-3 w-1/3 bg-bone animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
