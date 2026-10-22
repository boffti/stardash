import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"
import { SESSION_COOKIE } from "@/lib/session-cookie"

export { SESSION_COOKIE }
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

// ponytail: secret is minted once and kept in the db, so self-hosters set no env var.
function secret(): string {
  const row = db.prepare("select value from meta where key = 'auth_secret'").get() as
    { value: string } | undefined
  if (row) return row.value
  db.prepare("insert or ignore into meta (key, value) values ('auth_secret', ?)").run(
    randomBytes(32).toString("hex"),
  )
  return secret()
}

/** Constant-time string equality for secrets and OAuth state values. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0) return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex")

/** Cookie value: `<userId>.<expiresAtMs>.<hmac>`; the signature covers id and expiry. */
export function signSession(userId: string, now = Date.now()) {
  const payload = `${userId}.${now + SESSION_MAX_AGE * 1000}`
  return `${payload}.${sign(payload)}`
}

export function verifySession(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null
  const [userId, exp, sig, extra] = value.split(".")
  // Canonical hex only: Buffer.from() would silently truncate at the first non-hex char.
  if (!userId || !/^\d+$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig) || extra !== undefined)
    return null
  const given = Buffer.from(sig, "hex")
  const expected = Buffer.from(sign(`${userId}.${exp}`), "hex")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return Number(exp) > now ? userId : null
}

/** Secure only when the instance is actually served over https; LAN self-hosts on http must still log in. */
export const sessionCookieOptions = (origin: string) => ({
  httpOnly: true,
  secure: origin.startsWith("https://"),
  sameSite: "lax" as const,
  maxAge: SESSION_MAX_AGE,
  path: "/",
})
