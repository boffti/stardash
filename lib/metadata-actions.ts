"use server"

// Server actions: the browser's way into lib/user-metadata.ts. Each one resolves
// the signed-in user from the session cookie, so clients never pass a user id.
import { getUser } from "@/lib/auth"
import * as meta from "@/lib/user-metadata"
import type { RepoStatus } from "@/lib/types"

async function uid() {
  const user = await getUser()
  if (!user) throw new Error("Unauthorized")
  return user.id
}

export async function updateRepoStatus(dbId: string, status: RepoStatus | null) {
  meta.updateRepoStatus(dbId, await uid(), status)
}
export async function updateRepoNotes(dbId: string, notes: string) {
  meta.updateRepoNotes(dbId, await uid(), notes)
}
export async function togglePin(dbId: string, isPinned: boolean) {
  meta.togglePin(dbId, await uid(), isPinned)
}

export async function createTag(label: string, color: string) {
  return meta.createTag(await uid(), label, color)
}
export async function updateTag(tagId: string, label: string, color: string) {
  return meta.updateTag(tagId, await uid(), label, color)
}
export async function deleteTag(tagId: string) {
  meta.deleteTag(tagId, await uid())
}
export async function assignTag(dbId: string, tagId: string) {
  meta.assignTag(dbId, await uid(), tagId)
}
export async function removeTag(dbId: string, tagId: string) {
  meta.removeTag(dbId, await uid(), tagId)
}

export async function createCollection(name: string, emoji: string, color: string) {
  return meta.createCollection(await uid(), name, emoji, color)
}
export async function updateCollection(id: string, name: string, emoji: string, color: string) {
  return meta.updateCollection(id, await uid(), name, emoji, color)
}
export async function deleteCollection(id: string) {
  meta.deleteCollection(id, await uid())
}
export async function assignCollection(dbId: string, collectionId: string) {
  meta.assignCollection(dbId, await uid(), collectionId)
}
export async function removeCollection(dbId: string, collectionId: string) {
  meta.removeCollection(dbId, await uid(), collectionId)
}
