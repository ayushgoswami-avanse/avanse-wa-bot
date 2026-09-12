import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/agent");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <Link href="/agent" className="font-semibold text-slate-900">
          SEC Agent Console
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>{session.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
