import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/agent");

  return (
    <div className="min-h-screen bg-[#f7fafb]">
      <header className="bg-gradient-to-r from-brand-teal-dark to-brand-deep px-6 py-3.5 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <Link href="/agent" className="font-semibold text-white flex items-center gap-2">
          <span className="w-7 h-7 rounded-md bg-white/15 flex items-center justify-center text-xs font-bold">SEC</span>
          Agent Console
        </Link>
        <div className="flex items-center gap-3 text-sm text-white/80">
          <span>{session.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="p-6 max-w-[1400px] mx-auto">{children}</main>
    </div>
  );
}
