"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAssetForm() {
  const router = useRouter();
  const [channel, setChannel] = useState("poster");
  const [collegeName, setCollegeName] = useState("");
  const [spotLabel, setSpotLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, collegeName, spotLabel }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Failed to create asset");
      return;
    }
    setCollegeName("");
    setSpotLabel("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Channel</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="poster">Poster</option>
          <option value="ambassador">Ambassador</option>
          <option value="event">Event</option>
          <option value="digital">Digital</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">College</label>
        <input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Spot label</label>
        <input value={spotLabel} onChange={(e) => setSpotLabel(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <button disabled={loading} className="rounded-md bg-slate-900 text-white text-sm px-4 py-1.5 hover:bg-slate-800 disabled:opacity-50">
        {loading ? "Creating..." : "Create asset"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
