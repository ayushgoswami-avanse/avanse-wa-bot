"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Overview", icon: "◈" },
  { href: "/admin/leads", label: "Leads", icon: "◐" },
  { href: "/admin/funnel", label: "Funnel & attribution", icon: "◭" },
  { href: "/admin/assets", label: "Assets & QR", icon: "▦" },
  { href: "/admin/payouts", label: "Payouts", icon: "◎" },
  { href: "/admin/costs", label: "Cost reporting", icon: "◫" },
  { href: "/admin/transcripts", label: "Transcript review", icon: "▤" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-white/10 text-white font-medium" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className={`text-xs w-4 text-center ${active ? "text-brand-teal" : "text-slate-500"}`}>{item.icon}</span>
            {item.label}
            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse-ring" />}
          </Link>
        );
      })}
    </nav>
  );
}
