export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card bg-base-200 shadow-sm overflow-hidden animate-pulse">
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <div className="skeleton h-3 w-20 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <div className={`skeleton h-3 rounded ${c === 0 ? "w-32" : c === cols - 1 ? "w-12" : "w-20"}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
