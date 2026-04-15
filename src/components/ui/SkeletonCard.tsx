export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card bg-base-200 shadow-sm animate-pulse">
      <div className="card-body gap-3">
        <div className="skeleton h-5 w-2/3 rounded" />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <div key={i} className={`skeleton h-3 rounded ${i === lines - 2 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function SkeletonCardGrid({ count = 3, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${LG_COLS[cols] ?? "lg:grid-cols-3"} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
