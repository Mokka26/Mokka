export default function Loading() {
  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      <div className="mb-16 lg:mb-24">
        <div className="h-3 w-24 bg-bone animate-shimmer mb-5" />
        <div className="h-12 w-64 bg-bone animate-shimmer" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-14 sm:gap-x-6 sm:gap-y-20">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-4">
            <div className="aspect-[4/5] bg-bone animate-shimmer" />
            <div className="h-3 w-3/4 bg-bone animate-shimmer" />
            <div className="h-3 w-1/3 bg-bone animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
