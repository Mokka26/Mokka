export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20">
      <div className="mb-10">
        <div className="h-3 w-24 bg-bone animate-shimmer mb-4" />
        <div className="h-8 w-64 bg-bone animate-shimmer" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-square bg-bone animate-shimmer" />
            <div className="h-3 w-3/4 bg-bone animate-shimmer" />
            <div className="h-4 w-1/3 bg-bone animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
