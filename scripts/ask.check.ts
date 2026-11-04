// Smallest check that fails if Ask's context building breaks: pnpm check:ask
process.env.DATABASE_PATH = ":memory:"
const { loadStarLines, narrow, toLine, keepKnown } = await import("../lib/ask")
const { db } = await import("../lib/db")
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`ask check failed: ${msg}`)
}

db.prepare("insert into profiles (id, github_id, github_username) values ('u1', '1', 'me')").run()
db.prepare(
  `insert into repos (id, github_repo_id, owner, name, full_name, description, language, topics)
   values ('r1', 1, 'dragonfly', 'df', 'dragonfly/df', 'In-memory store, Redis compatible', 'C++', '["cache","redis"]')`,
).run()
db.prepare(
  "insert into user_starred_repos (id, user_id, repo_id, status, notes) values ('s1', 'u1', 'r1', 'currently-using', 'swap for redis at work')",
).run()
db.prepare(
  "insert into tags (id, user_id, label, color) values ('t1', 'u1', 'database', '#000')",
).run()
db.prepare(
  "insert into user_starred_repo_tags (user_starred_repo_id, tag_id, user_id) values ('s1', 't1', 'u1')",
).run()

const lines = loadStarLines("u1")
assert(lines.length === 1 && lines[0].tags[0] === "database", "loads tags")
assert(loadStarLines("u2").length === 0, "scoped to the user")
const line = toLine(lines[0])
assert(
  line.startsWith("dragonfly/df | C++ | In-memory") &&
    line.includes("topics: cache, redis") &&
    line.includes("status: currently-using") &&
    line.includes("notes: swap for redis"),
  `line: ${line}`,
)

const many = Array.from({ length: 10 }, (_, i) => ({
  ...lines[0],
  fullName: `o/r${i}`,
  description: i === 7 ? "a postgres pooler" : "unrelated",
  topics: [],
  tags: [],
  notes: null,
}))
const cut = narrow(many, "what postgres pooler do I have?", 3)
assert(cut.length === 3 && cut[0].fullName === "o/r7", "big libraries keep keyword matches")
assert(narrow(many, "x", 50).length === 10, "small libraries pass through")

const kept = keepKnown(
  [
    { fullName: "Dragonfly/DF", reason: "a" },
    { fullName: "made/up", reason: "b" },
    { fullName: "dragonfly/df", reason: "dup" },
  ],
  ["dragonfly/df"],
)
assert(
  kept.length === 1 && kept[0].fullName === "dragonfly/df",
  "drops invented and repeated repos",
)
assert(
  keepKnown([{ fullName: "df", reason: "bare" }], ["dragonfly/df"])[0]?.fullName === "dragonfly/df",
  "bare repo name resolves when unique",
)
assert(
  keepKnown([{ fullName: "df", reason: "bare" }], ["a/df", "b/df"]).length === 0,
  "ambiguous bare name is dropped",
)
console.log("ask check ok")
