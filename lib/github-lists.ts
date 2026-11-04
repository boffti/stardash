import { db, nowIso, toJson, fromJson } from "@/lib/db"

// Two-way sync between StarDash collections and GitHub star lists (GraphQL only; REST has no lists).
// Each link remembers the repos that were on both sides at the last sync, so a run can tell which
// side changed: adds from either side are kept, a removal on either side wins.

const GITHUB_LIST_CAP = 32 // GitHub's per-account limit on lists
const MAX_WRITES_PER_RUN = 400 // GitHub allows ~500 content writes an hour; the rest go next run
const WRITE_GAP_MS = 800

type Gql = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>

function gqlClient(token: string): Gql {
  return async (query, variables) => {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      data?: unknown
      errors?: { message: string }[]
    }
    if (!res.ok || body.errors?.length) {
      throw new Error(body.errors?.[0]?.message ?? `GitHub GraphQL ${res.status}`)
    }
    return body.data as never
  }
}

export interface RemoteList {
  id: string
  name: string
  items: Map<string, string> // full name (lowercase) -> repo node id
}

async function fetchLists(gql: Gql): Promise<{ login: string; lists: RemoteList[] }> {
  const data = await gql<{
    viewer: { login: string; lists: { nodes: { id: string; name: string }[] } }
  }>(`{ viewer { login lists(first: 100) { nodes { id name } } } }`)
  const lists: RemoteList[] = []
  for (const l of data.viewer.lists.nodes) {
    const items = new Map<string, string>()
    let after: string | null = null
    do {
      const page: {
        node: {
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string }
            nodes: { id?: string; nameWithOwner?: string }[]
          }
        }
      } = await gql(
        `query($id: ID!, $after: String) { node(id: $id) { ... on UserList {
          items(first: 100, after: $after) { pageInfo { hasNextPage endCursor }
            nodes { ... on Repository { id nameWithOwner } } } } } }`,
        { id: l.id, after },
      )
      for (const n of page.node.items.nodes) {
        if (n.id && n.nameWithOwner) items.set(n.nameWithOwner.toLowerCase(), n.id)
      }
      after = page.node.items.pageInfo.hasNextPage ? page.node.items.pageInfo.endCursor : null
    } while (after)
    lists.push({ id: l.id, name: l.name, items })
  }
  return { login: data.viewer.login, lists }
}

// GitHub App tokens can read lists but not write them; GitHub has no app permission for lists.
const isNoWriteAccess = (err: unknown) =>
  err instanceof Error && err.message.includes("does not have the correct permissions")

/** Repo node ids by full name, 50 per query. Unknown or renamed repos are left out. */
async function lookupNodeIds(gql: Gql, fullNames: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < fullNames.length; i += 50) {
    const chunk = fullNames.slice(i, i + 50)
    const fields = chunk
      .map((full, j) => {
        const [owner, name] = full.split("/")
        return `r${j}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { id nameWithOwner }`
      })
      .join("\n")
    // A missing repo nulls its alias and adds an error; keep the rest.
    const res = await gql<Record<string, { id: string; nameWithOwner: string } | null>>(
      `{ ${fields} }`,
    ).catch(() => ({}) as Record<string, null>)
    chunk.forEach((full, j) => {
      const hit = res[`r${j}`]
      if (hit) out.set(full, hit.id)
    })
  }
  return out
}

/**
 * The three-way merge for one linked pair. `base` is what both sides held at the last sync.
 * Adds from either side are kept; a removal on either side wins.
 */
export function mergeMembers(base: Set<string>, local: Set<string>, remote: Set<string>) {
  const out = new Set<string>()
  for (const x of new Set([...base, ...local, ...remote])) {
    const inBase = base.has(x)
    const keep = inBase ? local.has(x) && remote.has(x) : local.has(x) || remote.has(x)
    if (keep) out.add(x)
  }
  return out
}

interface LinkRow {
  rowid: number
  collection_id: string | null
  list_id: string | null
  synced: string
}

export interface ListsSyncStatus {
  state: "idle" | "running" | "done" | "error"
  done: number
  total: number
  linked: number
  createdLists: number
  createdCollections: number
  pending: number
  /** The token could not write lists, so this run only imported from GitHub. */
  readOnly?: boolean
  error?: string
  finishedAt?: string
}

const statusKey = (userId: string) => `lists-sync:${userId}`

export function getListsSyncStatus(userId: string): ListsSyncStatus {
  const row = db.prepare("select value from meta where key = ?").get(statusKey(userId)) as
    { value: string } | undefined
  return fromJson<ListsSyncStatus>(row?.value, {
    state: "idle",
    done: 0,
    total: 0,
    linked: 0,
    createdLists: 0,
    createdCollections: 0,
    pending: 0,
  })
}

function setStatus(userId: string, status: ListsSyncStatus) {
  db.prepare("insert or replace into meta (key, value) values (?, ?)").run(
    statusKey(userId),
    toJson(status),
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One sync run for one user. Safe to re-run: unfinished writes are picked up next time. */
export async function syncGitHubLists(
  userId: string,
  token: string,
  opts: RunOptions = {},
): Promise<ListsSyncStatus> {
  const status: ListsSyncStatus = {
    state: "running",
    done: 0,
    total: 0,
    linked: 0,
    createdLists: 0,
    createdCollections: 0,
    pending: 0,
  }
  setStatus(userId, status)
  try {
    await run(userId, token, status, opts)
    status.state = "done"
  } catch (err) {
    status.state = "error"
    status.error = err instanceof Error ? err.message : String(err)
  }
  status.finishedAt = nowIso()
  setStatus(userId, status)
  return status
}

/** Overrides for scripts/lists.check.ts. */
interface RunOptions {
  gapMs?: number
  maxWrites?: number
}

async function run(userId: string, token: string, status: ListsSyncStatus, opts: RunOptions) {
  const { gapMs = WRITE_GAP_MS, maxWrites = MAX_WRITES_PER_RUN } = opts
  const gql = gqlClient(token)
  const { login, lists: remote } = await fetchLists(gql)
  const owner = db.prepare("select github_username from profiles where id = ?").get(userId) as
    { github_username: string | null } | undefined
  if (owner?.github_username && owner.github_username.toLowerCase() !== login.toLowerCase()) {
    throw new Error(`GITHUB_PAT belongs to ${login}, not ${owner.github_username}`)
  }
  const remoteById = new Map(remote.map((l) => [l.id, l]))

  // Local state: collections and their members by full name (lowercase), and the user's stars.
  const starRows = db
    .prepare(
      `select usr.id as usr_id, lower(r.full_name) as full from user_starred_repos usr
       join repos r on r.id = usr.repo_id where usr.user_id = ?`,
    )
    .all(userId) as { usr_id: string; full: string }[]
  const usrByFull = new Map(starRows.map((r) => [r.full, r.usr_id]))
  const collections = db
    .prepare("select id, name from collections where user_id = ?")
    .all(userId) as { id: string; name: string }[]
  const membersOf = (collectionId: string) =>
    new Set(
      (
        db
          .prepare(
            `select lower(r.full_name) as full from user_starred_repo_collections j
             join user_starred_repos usr on usr.id = j.user_starred_repo_id
             join repos r on r.id = usr.repo_id
             where j.user_id = ? and j.collection_id = ?`,
          )
          .all(userId, collectionId) as { full: string }[]
      ).map((r) => r.full),
    )

  const links = () =>
    db
      .prepare(
        "select rowid, collection_id, list_id, synced from github_list_links where user_id = ?",
      )
      .all(userId) as unknown as LinkRow[]

  // A list deleted on GitHub unlinks its collection; the collection stays and is not pushed again.
  for (const l of links()) {
    if (l.list_id && !remoteById.has(l.list_id)) {
      db.prepare("update github_list_links set list_id = null where rowid = ?").run(l.rowid)
    }
  }
  db.prepare(
    "delete from github_list_links where user_id = ? and collection_id is null and list_id is null",
  ).run(userId)

  const known = links()
  const linkedLists = new Set(known.map((l) => l.list_id).filter(Boolean))
  const linkedCollections = new Set(known.map((l) => l.collection_id).filter(Boolean))
  const insertLink = db.prepare(
    "insert into github_list_links (user_id, collection_id, list_id, synced) values (?, ?, ?, '[]')",
  )

  // Never seen on either side: pair by name first, then import or push the rest.
  const freeCollections = collections.filter((c) => !linkedCollections.has(c.id))
  for (const list of remote.filter((l) => !linkedLists.has(l.id))) {
    const match = freeCollections.find((c) => c.name.toLowerCase() === list.name.toLowerCase())
    let collectionId = match?.id
    if (match) freeCollections.splice(freeCollections.indexOf(match), 1)
    if (!collectionId) {
      collectionId = (
        db
          .prepare("insert into collections (user_id, name) values (?, ?) returning id")
          .get(userId, list.name) as { id: string }
      ).id
      status.createdCollections++
    }
    insertLink.run(userId, collectionId, list.id)
  }
  let listCount = remote.length
  for (const c of freeCollections) {
    if (listCount >= GITHUB_LIST_CAP) break // ponytail: the rest stay StarDash-only until a slot frees
    const created = await gql<{ createUserList: { list: { id: string; name: string } } }>(
      `mutation($name: String!) { createUserList(input: { name: $name, isPrivate: true }) { list { id name } } }`,
      { name: c.name.slice(0, 50) },
    ).catch((err) => {
      if (!isNoWriteAccess(err)) throw err
      status.readOnly = true
      return null
    })
    if (!created) break // unlinked collections are pushed once a token can write
    const list = { ...created.createUserList.list, items: new Map<string, string>() }
    remote.push(list)
    remoteById.set(list.id, list)
    insertLink.run(userId, c.id, list.id)
    listCount++
    status.createdLists++
  }

  // Merge every live pair. Remote sets only count repos StarDash knows, so others are never touched.
  const active = links().filter((l) => l.collection_id && l.list_id)
  status.linked = active.length
  const finalByList = new Map<string, Set<string>>()
  const addLocal = db.prepare(
    "insert or ignore into user_starred_repo_collections (user_starred_repo_id, collection_id, user_id) values (?, ?, ?)",
  )
  const removeLocal = db.prepare(
    "delete from user_starred_repo_collections where user_starred_repo_id = ? and collection_id = ? and user_id = ?",
  )
  const bases = new Map<number, Set<string>>()
  db.exec("begin")
  try {
    for (const link of active) {
      const list = remoteById.get(link.list_id!)!
      const base = new Set(fromJson<string[]>(link.synced, []))
      const local = membersOf(link.collection_id!)
      const remoteSet = new Set([...list.items.keys()].filter((f) => usrByFull.has(f)))
      const final = mergeMembers(base, local, remoteSet)
      for (const f of final)
        if (!local.has(f)) addLocal.run(usrByFull.get(f)!, link.collection_id, userId)
      for (const f of local)
        if (!final.has(f)) removeLocal.run(usrByFull.get(f)!, link.collection_id, userId)
      finalByList.set(list.id, final)
      bases.set(link.rowid, base)
    }
    db.exec("commit")
  } catch (err) {
    db.exec("rollback")
    throw err
  }

  // GitHub sets a repo's lists all at once, so diff per repo across every list.
  const membership = (full: string, pick: (list: RemoteList) => boolean) =>
    remote.filter(pick).map((l) => l.id)
  const changed: { full: string; listIds: string[] }[] = []
  for (const full of usrByFull.keys()) {
    const now = membership(full, (l) => l.items.has(full))
    const want = membership(full, (l) =>
      finalByList.has(l.id) ? finalByList.get(l.id)!.has(full) : l.items.has(full),
    )
    if (now.join() !== want.join()) changed.push({ full, listIds: want })
  }
  status.total = changed.length

  const nodeIds = new Map<string, string>()
  for (const l of remote) for (const [full, id] of l.items) nodeIds.set(full, id)
  const missing = changed.map((c) => c.full).filter((f) => !nodeIds.has(f))
  for (const [full, id] of await lookupNodeIds(gql, missing)) nodeIds.set(full, id)

  const pending = new Set(changed.map((c) => c.full))
  try {
    for (const c of changed.slice(0, maxWrites)) {
      const itemId = nodeIds.get(c.full)
      if (!itemId) continue // renamed or gone on GitHub; stays pending
      try {
        await gql(
          `mutation($itemId: ID!, $listIds: [ID!]!) { updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) { clientMutationId } }`,
          { itemId, listIds: c.listIds },
        )
      } catch (err) {
        if (!isNoWriteAccess(err)) throw err
        status.readOnly = true // imports are already saved; the writes wait for a writable token
        break
      }
      pending.delete(c.full)
      status.done++
      if (status.done % 10 === 0) setStatus(userId, status)
      if (gapMs) await sleep(gapMs)
    }
  } finally {
    // Synced = merged result, except repos still waiting on a GitHub write keep their old state,
    // so the next run sees the same change and finishes it.
    const save = db.prepare("update github_list_links set synced = ? where rowid = ?")
    for (const link of active) {
      const final = finalByList.get(link.list_id!)!
      const base = bases.get(link.rowid)!
      const synced = [...new Set([...final, ...base])].filter((f) =>
        pending.has(f) ? base.has(f) : final.has(f),
      )
      save.run(toJson(synced.sort()), link.rowid)
    }
    status.pending = pending.size
  }
}
