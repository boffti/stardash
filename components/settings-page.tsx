"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import useSWR from "swr"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { Collection, Tag as TagType, UserMetadata } from "@/lib/types"
import {
  createCollection,
  createTag,
  deleteCollection,
  deleteTag,
  updateCollection,
  updateTag,
} from "@/lib/metadata-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { AIKeySettings } from "@/components/ai-key-settings"
import { cn } from "@/lib/utils"
import { useI18n, type Language } from "@/components/i18n-provider"
import { useTheme } from "@/components/theme-provider"
import { useUser } from "@/components/providers/user-provider"
import { paletteInk } from "@/lib/palette"

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false
const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to load metadata")
  }
  return response.json()
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
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(collection.name)
  const [emoji, setEmoji] = useState(collection.emoji)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleCancel = () => {
    setEditing(false)
    setName(collection.name)
    setEmoji(collection.emoji)
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between gap-4 px-3",
          editing ? "min-h-12 py-2" : "h-12",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_72px]">
                <Input
                  id={`collection-name-${collection.id}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Collection name", "收藏夹名称")}
                  aria-label={t("Name", "名称")}
                  className="h-8 shadow-none"
                />
                <Input
                  id={`collection-emoji-${collection.id}`}
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="📁"
                  aria-label={t("Emoji", "表情")}
                  className="h-8 shadow-none"
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-base leading-none">{emoji || "📁"}</span>
                <p className="truncate text-[13px] text-foreground">{collection.name}</p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {repoCount}
                </span>
              </div>
            )}
          </div>

          {editing ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                className={settingsButton}
                onClick={handleCancel}
                disabled={isSaving}
              >
                {t("Cancel", "取消")}
              </Button>
              <Button
                variant="outline"
                className={settingsButton}
                onClick={async () => {
                  await onSave({ name, emoji, color: paletteInk(name) })
                  setEditing(false)
                }}
                disabled={!name.trim() || isSaving}
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("Save", "保存")}
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(true)}
                aria-label={t("Edit collection", "编辑收藏夹")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirmOpen(true)}
                aria-label={t("Delete collection", "删除收藏夹")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete collection?", "删除收藏夹？")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "This removes the collection and its assignments. Repositories are kept.",
                "删除收藏夹及其仓库关联，仓库本身会保留。",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onDelete()
                setConfirmOpen(false)
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Delete", "删除")}
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
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(tag.label)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleCancel = () => {
    setEditing(false)
    setLabel(tag.label)
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between gap-4 px-3",
          editing ? "min-h-12 py-2" : "h-12",
        )}
      >
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              id={`tag-label-${tag.id}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("Tag label", "标签名称")}
              aria-label={t("Label", "标签名称")}
              className="h-8 shadow-none"
            />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: paletteInk(tag.label) }}
              />
              <p className="truncate text-[13px] text-foreground">{tag.label}</p>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {repoCount}
              </span>
            </div>
          )}
        </div>

        {editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              className={settingsButton}
              onClick={handleCancel}
              disabled={isSaving}
            >
              {t("Cancel", "取消")}
            </Button>
            <Button
              variant="outline"
              className={settingsButton}
              onClick={async () => {
                await onSave({ label, color: paletteInk(label) })
                setEditing(false)
              }}
              disabled={!label.trim() || isSaving}
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("Save", "保存")}
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(true)}
              aria-label={t("Edit tag", "编辑标签")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmOpen(true)}
              aria-label={t("Delete tag", "删除标签")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete tag?", "删除标签？")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "This removes the tag and clears its repo assignments. The repositories themselves will not be deleted.",
                "删除标签及其仓库关联，仓库本身不会被删除。",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onDelete()
                setConfirmOpen(false)
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Delete", "删除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const settingsButton = "h-7 rounded-md px-2.5 text-[13px] shadow-none"
const settingsPanel = "w-full divide-y divide-border/60 overflow-hidden rounded-lg bg-muted"

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-12 items-center justify-between gap-4 px-3">
      <div className="min-w-0">
        <p className="text-[13px] leading-4 text-foreground">{title}</p>
        {description ? (
          <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function Segmented({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-7 shrink-0 items-center rounded-md p-0.5"
    >
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { user } = useUser()
  const { language, setLanguage, t } = useI18n()
  const { theme, setTheme } = useTheme()
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [createTagOpen, setCreateTagOpen] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const {
    data: metadata,
    mutate,
    isLoading,
  } = useSWR<UserMetadata>(user.id ? "/api/user/metadata" : null, fetcher, {
    revalidateOnFocus: false,
  })

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
        (repoMeta) => repoMeta.tagIds.length === 0 && repoMeta.collectionIds.length === 0,
      ).length,
    [metadata],
  )

  const handleCreateCollection = async (name: string, emoji: string, color: string) => {
    try {
      await createCollection(name, emoji, color)
      await mutate()
      toast.success(t("Collection created", "收藏夹已创建"))
    } catch (error) {
      const message = (error as Error).message
      toast.error(
        message.includes("unique")
          ? t("Collection already exists", "收藏夹已存在")
          : t("Failed to create collection", "创建收藏夹失败"),
      )
      throw error
    }
  }

  const handleCreateTag = async (label: string) => {
    try {
      await createTag(label, paletteInk(label))
      await mutate()
      toast.success(t("Tag created", "标签已创建"))
    } catch (error) {
      const message = (error as Error).message
      toast.error(
        message.includes("unique")
          ? t("Tag already exists", "标签已存在")
          : t("Failed to create tag", "创建标签失败"),
      )
      throw error
    }
  }

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
          <AppPageHeader lastSynced={null} hideNavActions />

          <main className="flex-1 px-8 py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
              <section className="space-y-2">
                <h2 className="px-1 text-[13px] font-medium">{t("General", "通用")}</h2>
                <div className={settingsPanel}>
                  <SettingsRow title={t("Theme", "主题")}>
                    <Segmented label={t("Theme", "主题")}>
                      {(
                        [
                          ["system", t("System", "跟随系统")],
                          ["light", t("Light", "浅色")],
                          ["dark", t("Dark", "深色")],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={hydrated && theme === value}
                          onClick={() => setTheme(value)}
                          className={cn(
                            "h-6 rounded-md px-2 text-xs shadow-none",
                            hydrated && theme === value
                              ? "bg-background text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </Segmented>
                  </SettingsRow>
                  <SettingsRow title={t("Language", "语言")}>
                    <Segmented label={t("Language", "语言")}>
                      {(
                        [
                          ["system", t("Browser", "浏览器")],
                          ["en", "English"],
                          ["zh-CN", "简体中文"],
                        ] satisfies [Language, string][]
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={language === value}
                          onClick={() => setLanguage(value)}
                          className={cn(
                            "h-6 rounded-md px-2 text-xs shadow-none",
                            language === value
                              ? "bg-background text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </Segmented>
                  </SettingsRow>
                </div>
              </section>
              <section className="space-y-2">
                <h2 className="px-1 text-[13px] font-medium">{t("AI", "AI")}</h2>
                <AIKeySettings />
              </section>
              <section className="space-y-6">
                <div>
                  {isLoading ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-muted/10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[13px] font-medium">{t("Collections", "收藏夹")}</p>
                          <Button
                            variant="outline"
                            className={settingsButton}
                            onClick={() => setCreateCollectionOpen(true)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t("New", "新建")}
                          </Button>
                        </div>
                        <div className={settingsPanel}>
                          {collections.length === 0 ? (
                            <p className="flex h-12 items-center px-3 text-[13px] text-muted-foreground">
                              {t("No collections yet", "还没有收藏夹")}
                            </p>
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
                                      await updateCollection(collection.id, name, emoji, color)
                                      await mutate()
                                      toast.success(t("Collection updated", "收藏夹已更新"))
                                    } catch (error) {
                                      const message = (error as Error).message
                                      toast.error(
                                        message.includes("unique")
                                          ? t("Collection already exists", "收藏夹已存在")
                                          : t("Failed to update collection", "更新收藏夹失败"),
                                      )
                                      throw error
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                  onDelete={async () => {
                                    setBusyKey(deleteKey)
                                    try {
                                      await deleteCollection(collection.id)
                                      await mutate()
                                      toast.success(t("Collection deleted", "收藏夹已删除"))
                                    } catch {
                                      toast.error(
                                        t("Failed to delete collection", "删除收藏夹失败"),
                                      )
                                      throw new Error("delete failed")
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                />
                              )
                            })
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[13px] font-medium">{t("Tags", "标签")}</p>
                          <Button
                            variant="outline"
                            className={settingsButton}
                            onClick={() => setCreateTagOpen(true)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t("New", "新建")}
                          </Button>
                        </div>
                        <div className={settingsPanel}>
                          {tags.length === 0 ? (
                            <p className="flex h-12 items-center px-3 text-[13px] text-muted-foreground">
                              {t("No tags yet", "还没有标签")}
                            </p>
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
                                      await updateTag(tag.id, label, color)
                                      await mutate()
                                      toast.success(t("Tag updated", "标签已更新"))
                                    } catch (error) {
                                      const message = (error as Error).message
                                      toast.error(
                                        message.includes("unique")
                                          ? t("Tag already exists", "标签已存在")
                                          : t("Failed to update tag", "更新标签失败"),
                                      )
                                      throw error
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                  onDelete={async () => {
                                    setBusyKey(deleteKey)
                                    try {
                                      await deleteTag(tag.id)
                                      await mutate()
                                      toast.success(t("Tag deleted", "标签已删除"))
                                    } catch {
                                      toast.error(t("Failed to delete tag", "删除标签失败"))
                                      throw new Error("delete failed")
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                />
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
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
