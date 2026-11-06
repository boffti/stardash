"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import useSWR from "swr"
import { FolderOpen, Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
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
import { AgentTokens } from "@/components/agent-tokens"
import { cn } from "@/lib/utils"
import { useI18n, type Language } from "@/components/i18n-provider"
import { useTheme } from "@/components/theme-provider"
import { useUser } from "@/components/providers/user-provider"

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

const TAG_PALETTE = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#f97316",
  "#6366f1",
]

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
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_88px]">
                  <div className="space-y-2">
                    <Label htmlFor={`collection-name-${collection.id}`}>{t("Name", "名称")}</Label>
                    <Input
                      id={`collection-name-${collection.id}`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("Collection name", "收藏夹名称")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`collection-emoji-${collection.id}`}>
                      {t("Emoji", "表情")}
                    </Label>
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
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                    style={{ backgroundColor: `${color}16` }}
                  >
                    {emoji || "📁"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {collection.name}
                      </p>
                      <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
                        {repoCount} {t("repos", "个仓库")}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("Used to group related starred repositories.", "用于整理相关的星标仓库。")}
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
                <Label>{t("Color", "颜色")}</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_PALETTE.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      className={cn(
                        "h-8 w-8 rounded-full border border-border/70 transition-transform hover:scale-105",
                        color === swatch &&
                          "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select ${swatch}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  {t("Cancel", "取消")}
                </Button>
                <Button
                  onClick={async () => {
                    await onSave({ name, emoji, color })
                    setEditing(false)
                  }}
                  disabled={!name.trim() || isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("Save Changes", "保存更改")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
  const [color, setColor] = useState(tag.color || TAG_PALETTE[0])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleCancel = () => {
    setEditing(false)
    setLabel(tag.label)
    setColor(tag.color || TAG_PALETTE[0])
  }

  return (
    <>
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-2">
                  <Label htmlFor={`tag-label-${tag.id}`}>{t("Label", "标签名称")}</Label>
                  <Input
                    id={`tag-label-${tag.id}`}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t("Tag label", "标签名称")}
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
                        {repoCount} {t("repos", "个仓库")}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(
                        "Lightweight labels for technologies, workflows, and themes.",
                        "用标签标记技术、工作流程和主题。",
                      )}
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
                <Label>{t("Color", "颜色")}</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_PALETTE.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      className={cn(
                        "h-8 w-8 rounded-full border border-border/70 transition-transform hover:scale-105",
                        color === swatch &&
                          "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select ${swatch}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  {t("Cancel", "取消")}
                </Button>
                <Button
                  onClick={async () => {
                    await onSave({ label, color })
                    setEditing(false)
                  }}
                  disabled={!label.trim() || isSaving}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("Save Changes", "保存更改")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
      await createTag(label, TAG_PALETTE[0])
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

          <main className="flex-1 p-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
              <section className="space-y-4">
                <h2 className="text-base font-semibold">
                  {t("Appearance & language", "外观与语言")}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">{t("Theme", "主题")}</p>
                    </div>
                    <div
                      role="group"
                      aria-label={t("Theme", "主题")}
                      className="flex flex-wrap gap-2"
                    >
                      {(
                        [
                          ["system", t("System", "跟随系统")],
                          ["light", t("Light", "浅色")],
                          ["dark", t("Dark", "深色")],
                        ] as const
                      ).map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={hydrated && theme === value ? "default" : "outline"}
                          aria-pressed={hydrated && theme === value}
                          onClick={() => setTheme(value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">{t("Language", "语言")}</p>
                    </div>
                    <div
                      role="group"
                      aria-label={t("Language", "语言")}
                      className="flex flex-wrap gap-2"
                    >
                      {(
                        [
                          ["system", t("Browser default", "跟随浏览器")],
                          ["en", "English"],
                          ["zh-CN", "简体中文"],
                        ] satisfies [Language, string][]
                      ).map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={language === value ? "default" : "outline"}
                          aria-pressed={language === value}
                          onClick={() => setLanguage(value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              <Separator />
              <AIKeySettings />
              <Separator />
              <AgentTokens />
              <Separator />
              <section className="space-y-4">
                <div>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                      <h2 className="text-base font-semibold">
                        {t("Collections and tags", "收藏夹与标签")}
                      </h2>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setCreateCollectionOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        {t("New collection", "新建收藏夹")}
                      </Button>
                      <Button className="rounded-xl" onClick={() => setCreateTagOpen(true)}>
                        <Plus className="h-4 w-4" />
                        {t("New tag", "新建标签")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  {isLoading ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-muted/10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Tabs defaultValue="collections" className="gap-6">
                      <TabsList className="gap-2 bg-transparent p-0">
                        <TabsTrigger value="collections">
                          <FolderOpen className="h-4 w-4" />
                          {t("Collections", "收藏夹")}
                        </TabsTrigger>
                        <TabsTrigger value="tags">
                          <Tag className="h-4 w-4" />
                          {t("Tags", "标签")}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="collections" className="space-y-3 pt-1">
                        {collections.length === 0 ? (
                          <p className="py-4 text-sm text-muted-foreground">
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
                                    toast.error(t("Failed to delete collection", "删除收藏夹失败"))
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
                          <p className="py-4 text-sm text-muted-foreground">
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
                      </TabsContent>
                    </Tabs>
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
