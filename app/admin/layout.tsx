import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import AdminNav from "./AdminNav";

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
    <div className="min-h-screen bg-[#f7fafb]">
      <div className="flex">
        <aside className="w-64 shrink-0 bg-gradient-to-b from-[#0b2e2d] to-[#0f1b1c] min-h-screen p-5 sticky top-0 h-screen">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center text-white text-xs font-bold shrink-0">
              AV
            </div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">Avanse SEC</div>
              <div className="text-[11px] text-slate-500">Admin console</div>
            </div>
          </div>
          <AdminNav />
          <div className="mt-10 pt-4 border-t border-white/10">
            <div className="text-xs text-slate-500 mb-2">{session.displayName}</div>
            <LogoutButton />
          </div>
        </aside>
        <main className="flex-1 p-8 max-w-[1500px]">{children}</main>
      </div>
    </div>
  );
}
