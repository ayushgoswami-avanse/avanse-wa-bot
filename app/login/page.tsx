"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Login failed");
      return;
    }
    router.push(params.get("next") ?? "/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b2e2d] via-[#0f3d3b] to-brand-blue px-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-blue/20 blur-3xl" />

      <form onSubmit={onSubmit} className="animate-scale-in relative w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-white/20 p-8 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center text-white font-bold shrink-0">
            AV
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">SEC Console</h1>
            <p className="text-xs text-slate-500">Student Experience Center — admin &amp; agent access</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-shadow"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-shadow"
          />
        </div>

        {error && <p className="text-sm text-red-600 animate-fade-in">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-brand-teal-dark to-brand-deep text-white text-sm font-medium py-2.5 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
