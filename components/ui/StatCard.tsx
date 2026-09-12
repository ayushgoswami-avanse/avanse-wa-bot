export function StatCard({
  label,
  value,
  sub,
  accent = "teal",
  index = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "teal" | "blue" | "red" | "amber" | "slate";
  index?: number;
}) {
  const accentBar: Record<string, string> = {
    teal: "bg-brand-teal",
    blue: "bg-brand-blue",
    red: "bg-red-500",
    amber: "bg-amber-500",
    slate: "bg-slate-300",
  };

  return (
    <div
      className="animate-slide-up relative overflow-hidden bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar[accent]}`} />
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
