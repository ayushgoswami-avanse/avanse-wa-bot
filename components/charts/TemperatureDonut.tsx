"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS: Record<string, string> = { Hot: "#ef4444", Warm: "#f59e0b", Cold: "#94a3b8" };

export function TemperatureDonut({ hot, warm, cold }: { hot: number; warm: number; cold: number }) {
  const data = [
    { name: "Hot", value: hot },
    { name: "Warm", value: warm },
    { name: "Cold", value: cold },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-slate-400">No leads yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3} animationDuration={600}>
          {data.map((d) => (
            <Cell key={d.name} fill={COLORS[d.name]} stroke="none" />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
