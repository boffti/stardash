import { randomBytes } from "node:crypto"

// CRON_SECRET lets an external scheduler call /api/cron/*. Without it, a secret is
// minted per process so the in-process scheduler (lib/scheduler.ts) can still call them.
const g = globalThis as typeof globalThis & { __cronSecret?: string }
export const cronSecret = () =>
  process.env.CRON_SECRET || (g.__cronSecret ??= randomBytes(24).toString("hex"))

export const isCronAuthorized = (request: Request) =>
  request.headers.get("authorization") === `Bearer ${cronSecret()}`
