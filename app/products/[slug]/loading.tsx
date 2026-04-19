export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20">
      <div className="h-3 w-48 bg-bone animate-shimmer mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
        <div className="aspect-square bg-bone animate-shimmer" />
        <div className="space-y-4 py-8">
          <div className="h-3 w-20 bg-bone animate-shimmer" />
          <div className="h-8 w-3/4 bg-bone animate-shimmer" />
          <div className="h-6 w-24 bg-bone animate-shimmer" />
          <div className="h-[1px] w-8 bg-bone my-6" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-bone animate-shimmer" />
            <div className="h-3 w-full bg-bone animate-shimmer" />
            <div className="h-3 w-2/3 bg-bone animate-shimmer" />
          </div>
          <div className="h-12 w-full bg-bone animate-shimmer mt-8" />
        </div>
      </div>
    </div>
  );
}
