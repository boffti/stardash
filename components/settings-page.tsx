"use client"

import { type ReactNode, useMemo, useState } from "react"
import useSWR from "swr"
import type { User } from "@supabase/supabase-js"
import { FolderOpen, Layers3, Loader2, Pencil, Plus, Settings, Tag, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import type { Collection, Tag as TagType, UserMetadata } from "@/lib/types"
import {
  createCollection,
  createTag,
  deleteCollection,
  deleteTag,
  updateCollection,
  updateTag,
} from "@/lib/user-metadata"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CreateCollectionModal } from "@/components/create-collection-modal"
import { CreateTagModal } from "@/components/create-tag-modal"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppPageHeader } from "@/components/app-page-header"
import { Separator } from "@/components/ui/separator"
import { AIKeySettings } from "@/components/ai-key-settings"
import { cn } from "@/lib/utils"

interface SettingsPageProps {
  user: User
}

const TAG_PALETTE = [
  "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899",
  "#06b6d4", "#ef4444", "#84cc16", "#f97316", "#6366f1",
]

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to load metadata")
  }
  return response.json()
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card className="border-dashed border-border/60 bg-muted/20">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/80 shadow-sm">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}

function CollectionEditor({
  collection,
  repoCount,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  collection: Collection
  repoCount: number
  onSave: (payload: { name: string; emoji: string; color: string }) => Promise<void>
  onDelete: () => Promise<void>
  isSaving: boolean
  isDeleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(collection.name)
  const [emoji, setEmoji] = useState(collection.emoji)
  const [color, setColor] = useState(collection.color || TAG_PALETTE[0])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleCancel = () => {
    setEditing(false)
    setName(collection.name)
    setEmoji(collection.emoji)
    setColor(collection.color || TAG_PALETTE[0])
  }

  return (
    <>
      <Card className="border-border/60 bg-background/80 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_88px]">
                  <div className="space-y-2">
                    <Label htmlFor={`collection-name-${collection.id}`}>Name</Label>
                    <Input
                      id={`collection-name-${collection.id}`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Collection name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`collection-emoji-${collection.id}`}>Emoji</Label>
                    <Input
                      id={`collection-emoji-${collection.id}`}
                      value={emoji}
                      onChange={(e) => setEmoji(e.target.value)}
                      placeholder="📁"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-base shadow-sm"
                    style={{ backgroundColor: `${color}16` }}
                  >
                    {emoji || "📁"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{collection.name}</p>
                      <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                        {repoCount} repos
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Used to group related starred repositories.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!editing && (
                <div className="flex items-center gap-2">
                  <button
                    className="h-6 w-6 rounded-full border border-border/70 transition-colors hover:bg-muted"
                    style={{ backgroundColor: color }}
                    aria-label={`${collection.name} color`}
                    disabled
                  />
                  <Button variant="outline" size="icon-sm" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {editing && (
            <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_PALETTE.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      className={cn(
                        "h-8 w-8 rounded-full border border-border/70 transition-transform hover:scale-105",
                        color === swatch && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      )}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select ${swatch}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await onSave({ name, emoji, color })
                    setEditing(false)
                  }}
                  disabled={!name.trim() || isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete collection?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the collection and its assignments from repos. Repositories themselves will stay in StarDash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onDelete()
                setConfirmOpen(false)
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function TagEditor({
  tag,
  repoCount,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  tag: TagType
  repoCount: number
  onSave: (payload: { label: string; color: string }) => Promise<void>
  onDelete: () => Promise<void>
  isSaving: boolean
  isDeleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(tag.label)
  const [color, setColor] = useState(tag.color || TAG_PALETTE[0])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleCancel = () => {
    setEditing(false)
    setLabel(tag.label)
    setColor(tag.color || TAG_PALETTE[0])
  }

  return (
    <>
      <Card className="border-border/60 bg-background/80 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-2">
                  <Label htmlFor={`tag-label-${tag.id}`}>Label</Label>
                  <Input
                    id={`tag-label-${tag.id}`}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Tag label"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-background shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{tag.label}</p>
                      <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                        {repoCount} repos
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Lightweight labels for technologies, workflows, and themes.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!editing && (
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="icon-sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {editing && (
            <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_PALETTE.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      className={cn(
                        "h-8 w-8 rounded-full border border-border/70 transition-transform hover:scale-105",
                        color === swatch && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      )}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select ${swatch}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await onSave({ label, color })
                    setEditing(false)
                  }}
                  disabled={!label.trim() || isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tag and clears its repo assignments. The repositories themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onDelete()
                setConfirmOpen(false)
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function SettingsPage({ user }: SettingsPageProps) {
  const supabase = createClient()
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [createTagOpen, setCreateTagOpen] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const { data: metadata, mutate, isLoading } = useSWR<UserMetadata>(
    user.id ? "/api/user/metadata" : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    Object.values(metadata?.repoMeta ?? {}).forEach((repoMeta) => {
      repoMeta.tagIds.forEach((tagId) => {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      })
    })
    return counts
  }, [metadata])

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    metadata?.collections.forEach((collection) => {
      counts.set(collection.id, collection.repoCount)
    })
    return counts
  }, [metadata])

  const collections = metadata?.collections ?? []
  const tags = metadata?.tags ?? []
  const uncategorizedCount = useMemo(
    () =>
      Object.values(metadata?.repoMeta ?? {}).filter(
        (repoMeta) => repoMeta.tagIds.length === 0 && repoMeta.collectionIds.length === 0
      ).length,
    [metadata]
  )
  const assignmentCount = useMemo(
    () =>
      Object.values(metadata?.repoMeta ?? {}).reduce(
        (sum, repoMeta) => sum + repoMeta.collectionIds.length + repoMeta.tagIds.length,
        0
      ),
    [metadata]
  )

  const handleCreateCollection = async (name: string, emoji: string, color: string) => {
    try {
      await createCollection(supabase, user.id, name, emoji, color)
      await mutate()
      toast.success("Collection created")
    } catch (error) {
      const message = (error as Error).message
      toast.error(message.includes("unique") ? "Collection already exists" : "Failed to create collection")
      throw error
    }
  }

  const handleCreateTag = async (label: string) => {
    try {
      await createTag(supabase, user.id, label, TAG_PALETTE[0])
      await mutate()
      toast.success("Tag created")
    } catch (error) {
      const message = (error as Error).message
      toast.error(message.includes("unique") ? "Tag already exists" : "Failed to create tag")
      throw error
    }
  }

  const username = user.user_metadata?.user_name || user.user_metadata?.preferred_username || "User"

  return (
    <>
      <SidebarProvider>
        <AppSidebar
          collections={collections}
          tags={tags}
          selectedCollection={null}
          selectedTag={null}
          showUncategorized={false}
          onSelectCollection={() => {}}
          onSelectTag={() => {}}
          onShowUncategorized={() => {}}
          totalStars={Object.keys(metadata?.repoMeta ?? {}).length}
          uncategorizedCount={uncategorizedCount}
          userId={user.id}
        />
        <SidebarInset className="overflow-x-hidden">
          <AppPageHeader
            lastSynced={null}
            user={user}
            hideNavActions
            actions={
              <>
                <Badge variant="outline" className="hidden rounded-full px-2.5 py-1 text-[11px] md:flex">
                  {collections.length} collections
                </Badge>
                <Badge variant="outline" className="hidden rounded-full px-2.5 py-1 text-[11px] md:flex">
                  {tags.length} tags
                </Badge>
              </>
            }
          />

          <main className="flex-1 p-6">
            <div className="flex w-full flex-col gap-6">
              <section className="space-y-3">
                <AIKeySettings />
              </section>
              <Separator />
              <section className="space-y-3">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground/70">Workspace Settings</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">Collections & Tags</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Tune the labels and buckets that power organization and filtering across StarDash.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <Card className="border-border/60 bg-card/80 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Collections</p>
                        <p className="text-xl font-semibold tracking-tight text-foreground">{collections.length}</p>
                        <p className="text-xs text-muted-foreground">Long-lived groups</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-muted-foreground">
                        <FolderOpen className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-card/80 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Tags</p>
                        <p className="text-xl font-semibold tracking-tight text-foreground">{tags.length}</p>
                        <p className="text-xs text-muted-foreground">Cross-cutting labels</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-muted-foreground">
                        <Tag className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-card/80 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Coverage</p>
                        <p className="text-xl font-semibold tracking-tight text-foreground">{assignmentCount}</p>
                        <p className="text-xs text-muted-foreground">{uncategorizedCount} uncategorized repos</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-muted-foreground">
                        <Layers3 className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
                  <CardHeader className="border-b border-border/60 bg-muted/15 px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          Taxonomy Management
                        </CardTitle>
                        <CardDescription className="max-w-2xl">
                          Refine the labels and buckets that shape your starred repo workspace. Edits here update the same metadata layer used throughout the dashboard.
                        </CardDescription>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                            {assignmentCount} active assignments
                          </Badge>
                          <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                            @{username}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setCreateCollectionOpen(true)}>
                          <Plus className="h-4 w-4" />
                          New Collection
                        </Button>
                        <Button className="rounded-xl" onClick={() => setCreateTagOpen(true)}>
                          <Plus className="h-4 w-4" />
                          New Tag
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 sm:p-6">
                    {isLoading ? (
                      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Tabs defaultValue="collections" className="gap-6">
                        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/40 p-1 sm:w-[320px]">
                          <TabsTrigger value="collections">
                            <FolderOpen className="h-4 w-4" />
                            Collections
                          </TabsTrigger>
                          <TabsTrigger value="tags">
                            <Tag className="h-4 w-4" />
                            Tags
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="collections" className="space-y-3 pt-1">
                          {collections.length === 0 ? (
                            <EmptyState
                              icon={<FolderOpen className="h-5 w-5 text-muted-foreground" />}
                              title="No collections yet"
                              description="Collections create a strong top-level structure for your starred repos. Add a few durable buckets like AI, DevTools, or Reading List."
                              action={
                                <Button onClick={() => setCreateCollectionOpen(true)}>
                                  <Plus className="h-4 w-4" />
                                  Create Collection
                                </Button>
                              }
                            />
                          ) : (
                            collections.map((collection) => {
                              const saveKey = `collection-save-${collection.id}`
                              const deleteKey = `collection-delete-${collection.id}`
                              return (
                                <CollectionEditor
                                  key={collection.id}
                                  collection={collection}
                                  repoCount={collectionCounts.get(collection.id) ?? 0}
                                  isSaving={busyKey === saveKey}
                                  isDeleting={busyKey === deleteKey}
                                  onSave={async ({ name, emoji, color }) => {
                                    setBusyKey(saveKey)
                                    try {
                                      await updateCollection(supabase, collection.id, name, emoji, color)
                                      await mutate()
                                      toast.success("Collection updated")
                                    } catch (error) {
                                      const message = (error as Error).message
                                      toast.error(message.includes("unique") ? "Collection already exists" : "Failed to update collection")
                                      throw error
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                  onDelete={async () => {
                                    setBusyKey(deleteKey)
                                    try {
                                      await deleteCollection(supabase, collection.id)
                                      await mutate()
                                      toast.success("Collection deleted")
                                    } catch {
                                      toast.error("Failed to delete collection")
                                      throw new Error("delete failed")
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                />
                              )
                            })
                          )}
                        </TabsContent>

                        <TabsContent value="tags" className="space-y-3 pt-1">
                          {tags.length === 0 ? (
                            <EmptyState
                              icon={<Tag className="h-5 w-5 text-muted-foreground" />}
                              title="No tags yet"
                              description="Tags work best for cross-cutting labels like frameworks, ecosystems, or job-to-be-done hints."
                              action={
                                <Button onClick={() => setCreateTagOpen(true)}>
                                  <Plus className="h-4 w-4" />
                                  Create Tag
                                </Button>
                              }
                            />
                          ) : (
                            tags.map((tag) => {
                              const saveKey = `tag-save-${tag.id}`
                              const deleteKey = `tag-delete-${tag.id}`
                              return (
                                <TagEditor
                                  key={tag.id}
                                  tag={tag}
                                  repoCount={tagCounts.get(tag.id) ?? 0}
                                  isSaving={busyKey === saveKey}
                                  isDeleting={busyKey === deleteKey}
                                  onSave={async ({ label, color }) => {
                                    setBusyKey(saveKey)
                                    try {
                                      await updateTag(supabase, tag.id, label, color)
                                      await mutate()
                                      toast.success("Tag updated")
                                    } catch (error) {
                                      const message = (error as Error).message
                                      toast.error(message.includes("unique") ? "Tag already exists" : "Failed to update tag")
                                      throw error
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                  onDelete={async () => {
                                    setBusyKey(deleteKey)
                                    try {
                                      await deleteTag(supabase, tag.id)
                                      await mutate()
                                      toast.success("Tag deleted")
                                    } catch {
                                      toast.error("Failed to delete tag")
                                      throw new Error("delete failed")
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                />
                              )
                            })
                          )}
                        </TabsContent>
                      </Tabs>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-border/60 bg-card shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Structure Guidelines</CardTitle>
                      <CardDescription>
                        Keep taxonomy compact and durable so filters stay useful as your stars grow.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        Use collections for long-lived buckets like AI, DevTools, Design, or Reading List.
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        Use tags for cross-cutting labels such as `react`, `cli`, `database`, or `agentic`.
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        Delete duplicates aggressively. Fewer, stronger labels make the dashboard easier to scan.
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-card shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Workspace Snapshot</CardTitle>
                      <CardDescription>
                        Quick context for how organized the current metadata set is.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Repos with no labels</span>
                        <Badge variant="outline" className="rounded-full">
                          {uncategorizedCount}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Named by</span>
                        <span className="font-medium text-foreground">@{username}</span>
                      </div>
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                        Changes here flow straight into filtering, repo detail panels, and dashboard organization.
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-card shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Design Intent</CardTitle>
                      <CardDescription>
                        The strongest setups usually use a small number of durable collections and lightweight tags.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        Start broad with collections, then add tags only where they improve search and scanning.
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        If a label stops being obvious after a week, merge it or delete it.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>

      <CreateCollectionModal
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        onCreate={handleCreateCollection}
      />
      <CreateTagModal
        open={createTagOpen}
        onOpenChange={setCreateTagOpen}
        onCreate={handleCreateTag}
      />
    </>
  )
}
