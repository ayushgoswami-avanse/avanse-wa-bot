import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/funnel", label: "Funnel & attribution" },
  { href: "/admin/assets", label: "Assets & QR" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/costs", label: "Cost reporting" },
  { href: "/admin/transcripts", label: "Transcript review" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Your role ({session.role}) doesn&apos;t have admin console access.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="w-64 shrink-0 bg-slate-900 text-slate-200 min-h-screen p-5">
          <div className="mb-8">
            <div className="text-white font-semibold">Avanse SEC</div>
            <div className="text-xs text-slate-400">Admin console (POC)</div>
          </div>
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 mb-2">{session.displayName}</div>
            <LogoutButton />
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
