import { DynamicIcon } from "@/components/dashboard/DynamicIcon";

export interface DashboardStatItem {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
}

interface StatsRowProps {
  stats: DashboardStatItem[];
}

/**
 * DaisyUI stats row for dashboard KPIs.
 */
export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
      {stats.map((s) => (
        <div key={s.label} className="bg-base-200 rounded-xl shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-content/60 uppercase tracking-wide">{s.label}</span>
            <DynamicIcon name={s.icon} className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-semibold text-base-content">{s.value}</div>
          {s.trend ? <div className="text-xs text-success">{s.trend}</div> : null}
        </div>
      ))}
    </div>
  );
}
