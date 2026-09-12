import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setConfig, CONFIG_DEFAULTS, type ConfigKey } from "@/lib/config";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { key, value } = await req.json();
  if (!(key in CONFIG_DEFAULTS)) return NextResponse.json({ error: "unknown config key" }, { status: 400 });

  await setConfig(key as ConfigKey, String(value));
  return NextResponse.json({ ok: true });
}
