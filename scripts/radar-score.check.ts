// Runnable self-check for lib/radar.ts scoring. Run: pnpm check:radar
import assert from "node:assert/strict"
import { buildTasteProfile, scoreCandidate } from "../lib/radar.ts"

const now = Date.parse("2026-09-04T00:00:00Z")
const day = 86_400_000

const profile = buildTasteProfile(
  [
    {
      topics: ["sqlite", "local-first"],
      language: "TypeScript",
      status: "currently-using",
      starredAt: new Date(now - 10 * day).toISOString(),
    },
    {
      topics: ["sqlite"],
      language: "Rust",
      status: "tried-liked",
      starredAt: new Date(now - 200 * day).toISOString(),
    },
    { topics: ["blockchain"], language: "Solidity", status: "tried-dropped", starredAt: null },
  ],
  now,
)

assert.equal(profile.topics.get("sqlite"), 3 * 1.5 + 2, "status × recency weights add up")
assert.ok((profile.topics.get("blockchain") ?? 0) < 0, "tried-dropped is a negative signal")

const base = {
  ghCreatedAt: null,
  followers: [] as string[],
  hn: null,
  starsThenWeekAgo: null,
  stargazersCount: 500,
}

const match = scoreCandidate(
  { ...base, topics: ["sqlite", "local-first"], language: "TypeScript" },
  profile,
  now,
)
const miss = scoreCandidate({ ...base, topics: ["blockchain"], language: "Solidity" }, profile, now)
assert.ok(match.score > miss.score, "taste match outranks a dropped-topic repo")
assert.ok(miss.score < 0, "dropped topic pulls the score negative")
assert.ok(
  match.reasons.some((r) => r.kind === "topic"),
  "topic reason emitted",
)

const social = scoreCandidate(
  { ...base, topics: [], language: null, followers: ["a", "b", "c"] },
  profile,
  now,
)
assert.ok(social.score > match.score, "three people you follow beats a topic match alone")
assert.match(social.reasons[0].text, /a, b and 1 more/, "people list copy")

const rising = scoreCandidate(
  { ...base, topics: [], language: null, starsThenWeekAgo: 1000, stargazersCount: 2000 },
  profile,
  now,
)
assert.ok(
  rising.reasons.some((r) => r.kind === "velocity" && r.text === "+1k stars this week"),
  "velocity reason formatted",
)

const flat = scoreCandidate(
  { ...base, topics: [], language: null, starsThenWeekAgo: 1000, stargazersCount: 1050 },
  profile,
  now,
)
assert.equal(flat.reasons.length, 0, "small growth is not called out")

const fresh = scoreCandidate(
  { ...base, topics: [], language: null, ghCreatedAt: new Date(now - 2 * day).toISOString() },
  profile,
  now,
)
assert.equal(fresh.reasons[0]?.kind, "new")

console.log("radar scoring: ok")
