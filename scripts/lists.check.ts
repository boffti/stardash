// Fails if GitHub Lists sync loses or invents memberships: pnpm check:lists
// Runs the real sync against a fake GitHub (fetch stub) and an in-memory DB.
process.env.DATABASE_PATH = ":memory:"
const { syncGitHubLists, mergeMembers } = await import("../lib/github-lists")
const { db } = await import("../lib/db")
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`lists check failed: ${msg}`)
}

// mergeMembers: adds from either side kept, a removal on either side wins.
const m = mergeMembers(new Set(["a", "b", "c"]), new Set(["a", "b", "x"]), new Set(["a", "c", "y"]))
assert([...m].sort().join() === "a,x,y", `merge: ${[...m]}`)

// Fake GitHub: lists of repo node ids. Node id = "N:" + full name.
const gh = new Map<string, { name: string; items: Set<string>; private: boolean }>()
let writes = 0
let nextList = 0
let failAfter = Infinity
let noWrite = false // like a GitHub App token: lists readable, not writable
let login = "me"
const denied = () =>
  new Response(
    JSON.stringify({
      errors: [{ message: "me does not have the correct permissions to execute `X`" }],
    }),
    { status: 200 },
  )
globalThis.fetch = (async (_url: string, init: { body: string }) => {
  const { query, variables: v = {} } = JSON.parse(init.body)
  const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })
  if (query.includes("viewer { login lists")) {
    return ok({
      viewer: { login, lists: { nodes: [...gh].map(([id, l]) => ({ id, name: l.name })) } },
    })
  }
  if (query.includes("items(first")) {
    const nodes = [...gh.get(v.id)!.items].map((id) => ({ id, nameWithOwner: id.slice(2) }))
    return ok({ node: { items: { pageInfo: { hasNextPage: false, endCursor: "" }, nodes } } })
  }
  if (noWrite && (query.includes("createUserList") || query.includes("updateUserListsForItem"))) {
    return denied()
  }
  if (query.includes("createUserList")) {
    const id = `L${++nextList}`
    gh.set(id, { name: v.name, items: new Set(), private: query.includes("isPrivate: true") })
    return ok({ createUserList: { list: { id, name: v.name } } })
  }
  if (query.includes("updateUserListsForItem")) {
    if (writes >= failAfter) {
      return new Response(JSON.stringify({ errors: [{ message: "secondary rate limit" }] }), {
        status: 403,
      })
    }
    writes++
    for (const [id, l] of gh) {
      if (v.listIds.includes(id)) l.items.add(v.itemId)
      else l.items.delete(v.itemId)
    }
    return ok({ updateUserListsForItem: { clientMutationId: null } })
  }
  if (query.includes("repository(owner")) {
    const out: Record<string, unknown> = {}
    for (const [, alias, owner, name] of query.matchAll(
      /(r\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\)/g,
    )) {
      out[alias] = { id: `N:${owner}/${name}`, nameWithOwner: `${owner}/${name}` }
    }
    return ok(out)
  }
  throw new Error(`unexpected query: ${query.slice(0, 60)}`)
}) as typeof fetch

// Fixtures: five starred repos, collection "Tools" holds a and b.
db.prepare("insert into profiles (id, github_id, github_username) values ('u1', '1', 'me')").run()
for (const [i, r] of ["o/a", "o/b", "o/c", "o/d", "o/e"].entries()) {
  db.prepare(
    "insert into repos (id, github_repo_id, owner, name, full_name) values (?, ?, 'o', ?, ?)",
  ).run(`r-${r}`, i + 1, r.slice(2), r)
  db.prepare("insert into user_starred_repos (id, user_id, repo_id) values (?, 'u1', ?)").run(
    `s-${r}`,
    `r-${r}`,
  )
}
const put = (collection: string, repo: string) =>
  db
    .prepare("insert or ignore into user_starred_repo_collections values (?, ?, 'u1')")
    .run(`s-${repo}`, collection)
const drop = (collection: string, repo: string) =>
  db
    .prepare(
      "delete from user_starred_repo_collections where user_starred_repo_id = ? and collection_id = ?",
    )
    .run(`s-${repo}`, collection)
const members = (collection: string) =>
  (
    db
      .prepare(
        `select r.full_name f from user_starred_repo_collections j join user_starred_repos s on s.id = j.user_starred_repo_id
     join repos r on r.id = s.repo_id where j.collection_id = ? order by f`,
      )
      .all(collection) as { f: string }[]
  )
    .map((r) => r.f)
    .join()
const items = (listName: string) =>
  [...[...gh.values()].find((l) => l.name === listName)!.items]
    .map((i) => i.slice(2))
    .sort()
    .join()

db.prepare("insert into collections (id, user_id, name) values ('cTools', 'u1', 'Tools')").run()
put("cTools", "o/a")
put("cTools", "o/b")
// GitHub already has "Reading" with c, and "tools" (same name, other case) with d.
gh.set("G1", { name: "Reading", items: new Set(["N:o/c"]), private: false })
gh.set("G2", { name: "tools", items: new Set(["N:o/d"]), private: false })

const sync = (maxWrites?: number) => syncGitHubLists("u1", "tok", { gapMs: 0, maxWrites })

// 1. First sync: "Tools" pairs with "tools" by name, "Reading" is imported, nothing duplicated.
let s = await sync()
assert(s.state === "done", `first sync: ${s.error}`)
assert(s.createdCollections === 1 && s.createdLists === 0, `created ${JSON.stringify(s)}`)
assert(
  members("cTools") === "o/a,o/b,o/d" && items("tools") === "o/a,o/b,o/d",
  `paired: ${members("cTools")} / ${items("tools")}`,
)
const reading = (
  db.prepare("select id from collections where name = 'Reading'").get() as { id: string }
).id
assert(members(reading) === "o/c", "imported list")

// 2. A new collection becomes a private list.
db.prepare("insert into collections (id, user_id, name) values ('cNew', 'u1', 'New')").run()
put("cNew", "o/e")
s = await sync()
const newList = [...gh.values()].find((l) => l.name === "New")
assert(newList?.private && items("New") === "o/e", "pushed as a private list")

// 3. Both sides change: local removes a and adds e; GitHub removes d and adds c.
drop("cTools", "o/a")
put("cTools", "o/e")
gh.get("G2")!.items.delete("N:o/d")
gh.get("G2")!.items.add("N:o/c")
s = await sync()
assert(
  members("cTools") === "o/b,o/c,o/e" && items("tools") === "o/b,o/c,o/e",
  `merged: ${members("cTools")} / ${items("tools")}`,
)
assert(items("Reading") === "o/c", "other lists keep their repos when a repo's lists are rewritten")

// 4. A write cap or rate limit mid-run: the rest is finished next run, nothing re-added or lost.
drop("cTools", "o/b")
drop("cTools", "o/c")
put("cTools", "o/d")
s = await sync(1)
assert(s.pending > 0, "cap leaves work pending")
failAfter = writes // now GitHub refuses every write
s = await sync()
assert(
  s.state === "error" && members("cTools") === "o/d,o/e",
  `failed run keeps local: ${members("cTools")}`,
)
failAfter = Infinity
s = await sync()
assert(s.state === "done" && s.pending === 0, `resumed: ${JSON.stringify(s)}`)
assert(
  members("cTools") === "o/d,o/e" && items("tools") === "o/d,o/e",
  `resumed: ${members("cTools")} / ${items("tools")}`,
)

// 5. Deletes unlink: neither side is re-created.
db.prepare("delete from collections where id = 'cNew'").run()
gh.delete("G1")
s = await sync()
assert(
  [...gh.values()].some((l) => l.name === "New"),
  "deleting a collection keeps its list",
)
assert(
  db.prepare("select 1 from collections where id = ?").get(reading),
  "deleting a list keeps its collection",
)
assert(
  !db.prepare("select 1 from collections where name = 'New'").get(),
  "an unlinked list is not re-imported",
)
const listsBefore = gh.size
s = await sync()
assert(gh.size === listsBefore, "an unlinked collection is not pushed again")

// 6. A token that can only read: GitHub changes come in, local changes wait for a writable token.
db.prepare("insert into collections (id, user_id, name) values ('cLater', 'u1', 'Later')").run()
put("cLater", "o/a")
gh.get("G2")!.items.add("N:o/a")
noWrite = true
s = await sync()
assert(s.state === "done" && s.readOnly, `read-only run: ${JSON.stringify(s)}`)
assert(members("cTools") === "o/a,o/d,o/e", `imported while read-only: ${members("cTools")}`)
assert(![...gh.values()].some((l) => l.name === "Later"), "no list created without write access")
drop("cTools", "o/e")
s = await sync()
assert(items("tools") === "o/a,o/d,o/e", "read-only leaves GitHub alone")
noWrite = false
s = await sync()
assert(s.state === "done" && !s.readOnly && s.pending === 0, `writable again: ${JSON.stringify(s)}`)
assert(
  items("Later") === "o/a" && items("tools") === "o/a,o/d",
  `caught up: ${items("Later")} / ${items("tools")}`,
)

// 7. A GITHUB_PAT for someone else's account is refused before anything is touched.
login = "someone-else"
s = await sync()
assert(s.state === "error" && s.error?.includes("someone-else"), `wrong account: ${s.error}`)

console.log("lists check ok")
