import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AgentRole } from "@prisma/client";

/** FR-H05 — role-based access for the admin/agent console.
 *
 * POC simplification: a single signed-cookie session (no SSO/MFA), which is what NFR-15's
 * "least privilege" section would want hardened before this is anything but a demo.
 * Logged in .ai/engineering/tech-debt.md.
 */

const COOKIE_NAME = "sec_session";

export type SessionClaims = { sub: string; email: string; role: AgentRole; displayName: string };

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(agent: { id: string; email: string; role: AgentRole; displayName: string }) {
  const token = jwt.sign(
    { sub: agent.id, email: agent.email, role: agent.role, displayName: agent.displayName } satisfies SessionClaims,
    jwtSecret(),
    { expiresIn: "12h" }
  );
  const store = await cookies();
  store.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret()) as SessionClaims;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

/** FR-H06 — financial detail masking for agents who don't require it. */
export function canViewFinancials(role: AgentRole): boolean {
  return role === "ADMIN" || role === "COMPLIANCE_VIEWER";
}

export async function findAgentByEmail(email: string) {
  return prisma.agentUser.findUnique({ where: { email } });
}
