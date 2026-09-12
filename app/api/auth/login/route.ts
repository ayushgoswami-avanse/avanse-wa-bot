import { NextRequest, NextResponse } from "next/server";
import { findAgentByEmail, verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const agent = await findAgentByEmail(email);
  if (!agent || !(await verifyPassword(password, agent.passwordHash))) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  await createSession(agent);
  return NextResponse.json({ ok: true, role: agent.role });
}
