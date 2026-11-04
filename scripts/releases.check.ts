// Smallest check that fails if releases tracking breaks: pnpm check:releases
process.env.DATABASE_PATH = ":memory:"
const { isBreaking, plainExcerpt, ingestReleases, releaseFeed, markReleasesSeen } =
  await import("../lib/releases")
const { db } = await import("../lib/db")
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`releases check failed: ${msg}`)
}

assert(isBreaking("v1.9.0", "v2.0.0", ""), "major bump")
assert(isBreaking("1.2.0", "1.3.0", "## BREAKING\nrenamed foo"), "keyword")
assert(!isBreaking("1.2.0", "1.2.1", "Fixed a typo"), "patch, plain notes")
assert(!isBreaking(null, "nightly", "no version"), "no semver, no keyword")
assert(plainExcerpt("## Fixes\n- [link](http://x) **bold**") === "Fixes - link bold", "excerpt")

db.prepare("insert into profiles (id, github_id, github_username) values ('u1', '1', 'me')").run()
db.prepare(
  "insert into repos (id, github_repo_id, owner, name, full_name) values ('r1', 1, 'acme', 'w', 'acme/w')",
).run()
db.prepare(
  "insert into user_starred_repos (user_id, repo_id, status) values ('u1', 'r1', 'currently-using')",
).run()

const rel = (tag: string, day: number, extra: object = {}) => ({
  tag_name: tag,
  name: tag,
  html_url: `https://github.com/acme/w/releases/${tag}`,
  published_at: `2026-10-${String(day).padStart(2, "0")}T00:00:00Z`,
  body: `notes for ${tag}`,
  draft: false,
  prerelease: false,
  ...extra,
})
let payload: object[] = []
let status = 200
globalThis.fetch = (async () =>
  new Response(status === 304 ? null : JSON.stringify(payload), {
    status,
    headers: { etag: '"e1"' },
  })) as typeof fetch

payload = [rel("v1.1.0", 2), rel("v1.0.0", 1)]
let s = await ingestReleases("t")
assert(s.fresh.length === 1 && s.fresh[0].tag === "v1.1.0", "first sight keeps only the latest")

payload = [rel("v3.0.0-rc1", 9, { prerelease: true }), rel("v2.0.0", 5), rel("v1.1.0", 2)]
s = await ingestReleases("t")
assert(s.fresh.length === 1 && s.fresh[0].tag === "v2.0.0", "adds newer, skips prereleases")
const feed = releaseFeed("u1")
assert(feed.tracked === 1 && feed.items.length === 2, "feed lists unread releases")
assert(feed.items[0].tag === "v2.0.0" && feed.items[0].breaking, "major bump flagged")
assert(!feed.items[1].breaking, "minor not flagged")

status = 304
assert((await ingestReleases("t")).notModified === 1, "etag 304 skipped")

const prev = markReleasesSeen("u1", "r1")
assert(prev && prev.previous === null && releaseFeed("u1").items.length === 0, "mark read")
markReleasesSeen("u1", "r1", prev!.previous)
assert(releaseFeed("u1").items.length === 2, "undo restores")
assert(markReleasesSeen("u2", "r1") === null, "other users cannot touch it")
console.log("releases check ok")
