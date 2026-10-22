// Smallest check that fails if the SQLite data layer breaks: pnpm check:db
process.env.DATABASE_PATH = ":memory:"
const meta = await import("../lib/user-metadata")
const { db } = await import("../lib/db")
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`db check failed: ${msg}`)
}

const user = "u1"
db.prepare("insert into profiles (id, github_id, github_username) values (?, ?, ?)").run(
  user,
  "1",
  "me",
)
const repo = (id: string, fullName: string) => ({
  id,
  owner: fullName.split("/")[0],
  name: fullName.split("/")[1],
  fullName,
  description: "",
  language: "TypeScript",
  languageColor: null,
  topics: ["sqlite", "local-first"],
  homepage: null,
  license: "MIT",
  stargazersCount: 10,
  forksCount: 1,
  openIssuesCount: 0,
  pushedAt: "2026-01-01T00:00:00.000Z",
  starredAt: "2026-01-02T00:00:00.000Z",
  avatarUrl: "",
  status: null,
  isPinned: false,
  notes: null,
  tags: [],
  collections: [],
  readme: null,
  archived: false,
})

meta.upsertStarredRepos([repo("100", "a/one"), repo("200", "a/two")], user)
assert(meta.getUserRepoMetadata(user).length === 2, "two stars after sync")

// second sync drops the unstarred repo and keeps the other's row id
const before = meta.getUserRepoMetadata(user).find((r) => r.github_repo_id === 100)!
meta.upsertStarredRepos([repo("100", "a/one")], user)
const after = meta.getUserRepoMetadata(user)
assert(
  after.length === 1 && after[0].user_starred_repo_id === before.user_starred_repo_id,
  "stale star removed, id stable",
)

const [tag] = meta.ensureTags(user, [{ label: "  SQLite ", color: "#000" }])
assert(tag.label === "sqlite", "label normalized")
assert(
  meta.ensureTags(user, [{ label: "sqlite", color: "#fff" }])[0].id === tag.id,
  "ensureTags idempotent",
)
meta.assignTag(before.user_starred_repo_id, user, tag.id)
meta.assignTag(before.user_starred_repo_id, user, tag.id)
const col = meta.createCollection(user, "Tools", "🔧", "#123")
meta.assignCollection(before.user_starred_repo_id, user, col.id)
meta.togglePin(before.user_starred_repo_id, user, true)
const row = meta.getUserRepoMetadata(user)[0]
assert(
  row.tag_ids.length === 1 && row.collection_ids[0] === col.id && row.is_pinned === true,
  "tags, collections, pin round-trip",
)

meta.deleteTag(tag.id, user)
assert(meta.getUserRepoMetadata(user)[0].tag_ids.length === 0, "tag delete cascades")
assert(meta.getUserRepoMetadata("someone-else").length === 0, "user scoping")

console.log("db: ok")

// Session cookie: signed, expiring, tamper-evident.
const session = await import("../lib/session")
const { safeNext } = await import("../lib/safe-next")
const t0 = 1_700_000_000_000
const cookie = session.signSession("42", t0)
assert(session.verifySession(cookie, t0 + 1000) === "42", "valid session verifies")
assert(
  session.verifySession(cookie, t0 + session.SESSION_MAX_AGE * 1000 + 1) === null,
  "expired session rejected",
)
assert(session.verifySession(cookie.replace("42.", "43."), t0) === null, "tampered id rejected")
assert(session.verifySession(cookie + "x", t0) === null, "tampered signature rejected")
assert(session.verifySession("42.deadbeef", t0) === null, "malformed cookie rejected")
assert(
  session.sessionCookieOptions("http://nas.local:3000").secure === false,
  "http origin: not Secure",
)
assert(
  session.sessionCookieOptions("https://stars.example.com").secure === true,
  "https origin: Secure",
)
for (const bad of ["//evil.com", "/\\evil.com", "/a b", "http://x", "", undefined]) {
  assert(safeNext(bad) === "/dashboard", `safeNext rejects ${JSON.stringify(bad)}`)
}
assert(safeNext("/radar?x=1") === "/radar?x=1", "safeNext keeps a same-origin path")
console.log("session: ok")

// API tokens: create once, verify by hash, revoke.
const tokens = await import("../lib/api-tokens")
const made = tokens.createApiToken(user, "check")
assert(
  made.token.startsWith("sd_") && tokens.verifyApiToken(made.token) === user,
  "token verifies to owner",
)
assert(
  tokens.verifyApiToken("sd_nope") === null && tokens.verifyApiToken(undefined) === null,
  "bad tokens rejected",
)
assert(
  tokens.listApiTokens(user).length === 1 && tokens.listApiTokens(user)[0].last_used_at,
  "listed with last_used_at",
)
assert(
  tokens.revokeApiToken(user, made.id) && tokens.verifyApiToken(made.token) === null,
  "revoked token rejected",
)
console.log("tokens: ok")
