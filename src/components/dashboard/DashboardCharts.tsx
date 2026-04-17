"use client";

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

interface ChartData {
  revenue: { name: string; revenue: number }[];
  tasks: { name: string; value: number }[];
  projects: { name: string; value: number }[];
  hiring: { name: string; value: number }[];
}

interface DashboardChartsProps {
  data: ChartData | null;
}

const COLORS = [
  "hsl(var(--p))",
  "hsl(var(--s))",
  "hsl(var(--a))",
  "hsl(var(--n))",
  "hsl(var(--er))",
  "hsl(var(--su))",
];

export function DashboardCharts({ data }: DashboardChartsProps) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
      {/* Revenue Line Chart */}
      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm font-semibold opacity-60 uppercase tracking-wider">
            Revenue Trend (Last 6 Months)
          </h2>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue}>
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
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--b1))", 
                    borderColor: "hsl(var(--bc) / 0.1)",
                    borderRadius: "0.5rem",
                    fontSize: "12px"
                  }}
                  itemStyle={{ color: "hsl(var(--p))" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--p))" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "hsl(var(--p))" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Task Distribution Bar Chart */}
      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm font-semibold opacity-60 uppercase tracking-wider">
            Task Status Distribution
          </h2>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.tasks}>
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
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.tasks.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Project Status Pie Chart */}
      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm font-semibold opacity-60 uppercase tracking-wider">
            Project Overview
          </h2>
          <div className="h-[300px] mt-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.projects}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.projects.map((entry, index) => (
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

      {/* Hiring Pipeline Pie Chart */}
      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm font-semibold opacity-60 uppercase tracking-wider">
            Hiring Pipeline
          </h2>
          <div className="h-[300px] mt-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.hiring}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.hiring.map((entry, index) => (
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
