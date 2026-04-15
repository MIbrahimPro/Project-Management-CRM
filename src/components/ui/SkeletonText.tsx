export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-5/6", "w-4/5", "w-3/4", "w-2/3", "w-1/2"];
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton h-3 rounded ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}
