import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/** Prisma 7 moved the datasource URL out of schema.prisma (see ADR-005/D-013 in
 * .ai/memory/decisions.md and .ai/engineering/tech-debt.md) — this file is where the
 * Prisma CLI (generate/db push/migrate) now gets it from. The Prisma Client used at
 * runtime by the app takes its own connection via a driver adapter — see lib/prisma.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
