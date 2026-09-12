const TEMP_STYLES: Record<string, string> = {
  Hot: "bg-red-50 text-red-700 ring-1 ring-red-200",
  Warm: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Cold: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

const SENTIMENT_STYLES: Record<string, string> = {
  POSITIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  NEUTRAL: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  NEGATIVE: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function TemperatureBadge({ value }: { value: "Hot" | "Warm" | "Cold" }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TEMP_STYLES[value]}`}>{value}</span>;
}

export function SentimentBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-xs text-slate-300">—</span>;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SENTIMENT_STYLES[value] ?? SENTIMENT_STYLES.NEUTRAL}`}>{value.toLowerCase()}</span>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="px-1.5 py-0.5 rounded bg-brand-teal-50 text-brand-teal-dark text-[10px] font-medium">{children}</span>;
}

export function StageBadge({ stage }: { stage: string }) {
  const isHandover = stage === "HUMAN_HANDOVER";
  const isCounselling = stage === "COUNSELLING";
  const style = isHandover
    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
    : isCounselling
    ? "bg-brand-teal-50 text-brand-teal-dark ring-1 ring-brand-teal/20"
    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
  const label = stage.replaceAll("_", " ").toLowerCase();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${style}`}>{label}</span>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-teal to-brand-blue text-white flex items-center justify-center text-xs font-semibold shrink-0">
      {initials || "?"}
    </div>
  );
}
