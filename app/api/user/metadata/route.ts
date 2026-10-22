import { NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { getUserRepoMetadata, listCollections, listTags } from "@/lib/user-metadata"

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const repoMeta: Record<
      string,
      {
        dbId: string
        status: string | null
        isPinned: boolean
        notes: string | null
        tagIds: string[]
        collectionIds: string[]
      }
    > = {}
    const collectionRepoCounts: Record<string, number> = {}

    for (const row of getUserRepoMetadata(user.id)) {
      repoMeta[String(row.github_repo_id)] = {
        dbId: row.user_starred_repo_id,
        status: row.status,
        isPinned: row.is_pinned,
        notes: row.notes,
        tagIds: row.tag_ids,
        collectionIds: row.collection_ids,
      }
      for (const id of row.collection_ids) {
        collectionRepoCounts[id] = (collectionRepoCounts[id] || 0) + 1
      }
    }

    const tags = listTags(user.id)
    const collections = listCollections(user.id).map((c) => ({
      ...c,
      repoCount: collectionRepoCounts[c.id] || 0,
    }))

    return NextResponse.json({ tags, collections, repoMeta })
  } catch {
    return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 500 })
  }
}
