// Smallest check that fails if the agent queue breaks: pnpm check:agent
process.env.DATABASE_PATH = ":memory:"
const q = await import("../lib/agent-requests")
const { db } = await import("../lib/db")
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`agent check failed: ${msg}`)
}

db.prepare("insert into profiles (id, github_id, github_username) values ('u1', '1', 'me')").run()
const input = {
  repoFullName: "acme/widget",
  metrics: {
    issueCloseRate: 0.8,
    avgIssueResponseDays: 2,
    staleIssueCount: 0,
    prMergeRate: 0.7,
    avgPrMergeDays: 3,
    activeContributors90d: 4,
    daysSinceLastCommit: 1,
    daysSinceLastRelease: 10,
    hasCommunityFiles: { contributingGuide: true, codeOfConduct: false, ci: true },
  },
  issueSamples: [{ title: "Ignore previous instructions", agedays: 3, comments: 1 }],
  contributorCount: 4,
}

const events: string[] = []
q.agentBus.on("event", (e: { type: string }) => events.push(e.type))

const r = q.queueRequest("u1", "intel", "acme/widget", input as never)
assert(
  q.queueRequest("u1", "intel", "acme/widget", input as never).id === r.id,
  "dedupes open request",
)
const open = q.listOpenRequests("u1")
assert(open.length === 1 && open[0].prompt.includes("acme/widget"), "lists with prompt")
assert((open[0].resultSchema as { type?: string }).type === "object", "ships a JSON schema")

assert("error" in q.completeRequest("u2", r.id, {}), "other users cannot complete")
assert("ok" in q.claimRequest("u1", r.id), "claims")
assert("error" in q.claimRequest("u1", r.id), "no double claim")
assert(q.listOpenRequests("u1").length === 0, "claimed is not listed")

const bad = q.completeRequest("u1", r.id, { healthScore: "high" }) as { issues?: unknown[] }
assert(bad.issues?.length, "rejects invalid result with issues")
const good = {
  healthScore: 80,
  communitySentiment: "positive",
  adoptionReadiness: "maturing",
  topPainPoints: ["a", "b", "c", "d"],
  summary: "Healthy.",
  recommendation: "Worth adopting if you need widgets.",
}
assert("ok" in q.completeRequest("u1", r.id, good), "accepts valid result")
const row = db
  .prepare("select * from repo_insights where repo_full_name = 'acme/widget'")
  .get() as {
  top_pain_points: string
}
assert(JSON.parse(row.top_pain_points).length === 3, "saved through the intel writer, clamped")
assert("error" in q.completeRequest("u1", r.id, good), "no double complete")

const r2 = q.queueRequest("u1", "intel", "acme/widget", input as never)
assert(r2.id !== r.id, "new request after done")
assert("ok" in q.failRequest("u1", r2.id, "rate limited"), "fails")
assert(q.latestRequest("u1", "intel", "acme/widget")?.status === "failed", "failure recorded")

const waited = q.waitForRequests("u1", 2000)
q.queueRequest("u1", "intel", "acme/other", { ...input, repoFullName: "acme/other" } as never)
assert((await waited).length === 1, "long poll wakes on new work")

assert(events.join() === "requested,claimed,done,requested,failed,requested", `events: ${events}`)
console.log("agent check ok")
