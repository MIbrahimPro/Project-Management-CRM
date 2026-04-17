"use client";

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";

interface HrChartData {
  hiringFunnel: { name: string; value: number }[];
  attendanceTrend: { name: string; present: number; late: number; absent: number }[];
  roles: { name: string; value: number }[];
}

interface HrDashboardChartsProps {
  data: HrChartData | null;
}

const COLORS = [
  "hsl(var(--p))",
  "hsl(var(--s))",
  "hsl(var(--a))",
  "hsl(var(--n))",
  "hsl(var(--er))",
  "hsl(var(--su))",
];

export function HrDashboardCharts({ data }: HrDashboardChartsProps) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Attendance Trend */}
      <div className="card bg-base-200 border border-base-300 shadow-sm xl:col-span-2">
        <div className="card-body">
          <h2 className="card-title text-sm font-semibold opacity-60 uppercase tracking-wider">
            Attendance Trend (Last 7 Days)
          </h2>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.1)" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--bc) / 0.5)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--bc) / 0.5)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--b1))", 
                    borderColor: "hsl(var(--bc) / 0.1)",
                    borderRadius: "0.5rem",
                    fontSize: "12px"
                  }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="present" fill="hsl(var(--su))" radius={[4, 4, 0, 0]} stackId="a" name="Present" />
                <Bar dataKey="late" fill="hsl(var(--wa))" radius={[4, 4, 0, 0]} stackId="a" name="Late" />
                <Bar dataKey="absent" fill="hsl(var(--er))" radius={[4, 4, 0, 0]} stackId="a" name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hiring Funnel */}
      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm font-semibold opacity-60 uppercase tracking-wider">
            Hiring Funnel
          </h2>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={data.hiringFunnel} margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bc) / 0.1)" />
                <XAxis type="number" stroke="hsl(var(--bc) / 0.5)" fontSize={12} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="hsl(var(--bc) / 0.5)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--bc) / 0.05)' }}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--b1))", 
                    borderColor: "hsl(var(--bc) / 0.1)",
                    borderRadius: "0.5rem",
                    fontSize: "12px"
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--p))" radius={[0, 4, 4, 0]} label={{ position: 'insideRight', fill: '#fff', fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Role Distribution */}
      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm font-semibold opacity-60 uppercase tracking-wider">
            Team Composition
          </h2>
          <div className="h-[300px] mt-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.roles}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.roles.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--b1))", 
                    borderColor: "hsl(var(--bc) / 0.1)",
                    borderRadius: "0.5rem",
                    fontSize: "12px"
                  }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
