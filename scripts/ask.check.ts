// Smallest check that fails if Ask's context building breaks: pnpm check:ask
process.env.DATABASE_PATH = ":memory:"
const { loadStarLines, narrow, toLine, keepKnown, askStars } = await import("../lib/ask")
const { MockLanguageModelV3 } = await import("ai/test")
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

db.prepare(
  "insert into profiles (id, github_id, github_username) values ('u3', '3', 'large')",
).run()
const addRepo = db.prepare(
  `insert into repos (id, github_repo_id, owner, name, full_name, description, topics)
   values (?, ?, 'example', ?, ?, ?, '[]')`,
)
const addStar = db.prepare("insert into user_starred_repos (user_id, repo_id) values ('u3', ?)")
for (let i = 0; i < 1201; i++) {
  const name = `repo${i}`
  addRepo.run(
    name,
    i + 100,
    name,
    `example/${name}`,
    i === 1200 ? "audio transcription with whisper" : "unrelated",
  )
  addStar.run(name)
}

let calls = 0
const model = new MockLanguageModelV3({
  doGenerate: async ({ prompt }) => {
    calls++
    const text =
      calls === 1
        ? JSON.stringify({ keywords: ["whisper", "transcription"] })
        : JSON.stringify({
            answer: "Found it",
            repos: [{ fullName: "example/repo1200", reason: "transcribes audio" }],
          })
    if (calls === 2) {
      assert(
        JSON.stringify(prompt).includes("example/repo1200"),
        "translated query includes the matching repo",
      )
    }
    return {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    }
  },
})
const answer = await askStars("u3", "语音转文字", model)
assert(
  answer.repos[0]?.fullName === "example/repo1200",
  "Chinese search finds an older repo in a large library",
)
console.log("ask check ok")
