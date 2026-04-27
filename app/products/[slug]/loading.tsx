export default function Loading() {
  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-14 pt-32 lg:pt-40 pb-28 lg:pb-40">
      <div className="h-3 w-48 bg-bone animate-shimmer mb-12" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
        <div className="lg:col-span-7">
          <div className="aspect-[4/5] bg-bone animate-shimmer mb-4" />
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-20 h-24 bg-bone animate-shimmer" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-6 lg:py-8">
          <div className="h-3 w-20 bg-bone animate-shimmer" />
          <div className="h-12 w-3/4 bg-bone animate-shimmer" />
          <div className="h-8 w-24 bg-bone animate-shimmer" />
          <div className="h-[1px] w-12 bg-bone my-10" />
          <div className="space-y-3">
            <div className="h-3 w-full bg-bone animate-shimmer" />
            <div className="h-3 w-full bg-bone animate-shimmer" />
            <div className="h-3 w-2/3 bg-bone animate-shimmer" />
          </div>
          <div className="h-14 w-full bg-bone animate-shimmer mt-10" />
        </div>
      </div>
    </div>
  );
}
