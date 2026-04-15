interface DashboardHeaderProps {
  userName: string;
  roleLabel: string;
}

function formatToday(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

/**
 * Greeting and current date for the dashboard top section.
 */
export function DashboardHeader({ userName, roleLabel }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-base-content">
          Hello, {userName}
        </h1>
        <p className="text-sm text-base-content/60 capitalize">{roleLabel}</p>
      </div>
      <p className="text-sm text-base-content/50 sm:text-end">{formatToday()}</p>
    </div>
  );
}
