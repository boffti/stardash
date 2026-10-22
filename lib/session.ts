import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/db"

export { SESSION_COOKIE } from "@/lib/session-cookie"
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

const sign = (userId: string) => createHmac("sha256", secret()).update(userId).digest("hex")

export const signSession = (userId: string) => `${userId}.${sign(userId)}`

export function verifySession(value: string | undefined): string | null {
  if (!value) return null
  const dot = value.lastIndexOf(".")
  if (dot <= 0) return null
  const userId = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1), "hex")
  const expected = Buffer.from(sign(userId), "hex")
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_MAX_AGE,
  path: "/",
}
