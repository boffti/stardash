"use client"

import { useI18n } from "@/components/i18n-provider"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { FolderOpen, Loader2, Smile } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const EMOJI_GROUPS = [
  {
    label: "Tech",
    items: ["💻", "⚡", "🚀", "🤖", "📱", "💾", "🌐", "🔧", "⚙️", "🎮", "💡", "🔌"],
  },
  {
    label: "Organization",
    items: ["📁", "📂", "🗂️", "📋", "📊", "📈", "📉", "📝", "📌", "📍", "🏷️", "🔖"],
  },
  {
    label: "Misc",
    items: ["⭐", "🔥", "💎", "🎯", "🎨", "🎬", "🎵", "📚", "🏠", "🌍", "🔒", "🔓"],
  },
  {
    label: "Smileys",
    items: ["😀", "😎", "👍", "❤️", "🎉", "✨", "🔥", "💯", "🆒", "🤩", "👋", "🙌"],
  },
]

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

const formSchema = (t: (english: string, chinese: string) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t("Name is required", "请输入名称"))
      .max(50, t("Name must be 50 characters or less", "名称不能超过 50 个字符")),
    emoji: z.string().max(2, t("Emoji should be a single character", "请选择单个表情")).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, t("Invalid color format", "颜色格式无效")),
  })

type FormData = z.infer<ReturnType<typeof formSchema>>

interface CreateCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, emoji: string, color: string) => Promise<void>
}

export function CreateCollectionModal({
  open,
  onOpenChange,
  onCreate,
}: CreateCollectionModalProps) {
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema(t)),
    defaultValues: {
      name: "",
      emoji: "",
      color: TAG_PALETTE[0],
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedColor = form.watch("color")

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await onCreate(data.name, data.emoji || "", data.color)
      form.reset()
      onOpenChange(false)
    } catch {
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t("Create Collection", "创建收藏夹")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Create a new collection to organize your starred repositories.",
              "创建收藏夹来整理星标仓库。",
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Name *", "名称 *")}</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., AI Tools" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Emoji", "表情")}</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-10 p-0 text-xl"
                          disabled={isSubmitting}
                        >
                          {field.value ? (
                            <span>{field.value}</span>
                          ) : (
                            <Smile className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="space-y-3">
                          {EMOJI_GROUPS.map((group) => (
                            <div
                              key={t(
                                group.label,
                                (
                                  {
                                    Tech: "技术",
                                    Organization: "整理",
                                    Misc: "其他",
                                    Smileys: "表情",
                                  } as Record<string, string>
                                )[group.label] ?? group.label,
                              )}
                            >
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                {t(
                                  group.label,
                                  (
                                    {
                                      Tech: "技术",
                                      Organization: "整理",
                                      Misc: "其他",
                                      Smileys: "表情",
                                    } as Record<string, string>
                                  )[group.label] ?? group.label,
                                )}
                              </p>
                              <div className="grid grid-cols-6 gap-1">
                                {group.items.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => field.onChange(emoji)}
                                    className={cn(
                                      "h-8 w-8 flex items-center justify-center rounded text-lg hover:bg-accent transition-colors",
                                      field.value === emoji && "bg-accent ring-1 ring-primary",
                                    )}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Color", "颜色")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {TAG_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => field.onChange(color)}
                          className={cn(
                            "h-8 w-8 rounded-full transition-all",
                            selectedColor === color
                              ? "ring-2 ring-offset-2 ring-primary scale-110"
                              : "hover:scale-105",
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={t(`Select color ${color}`, `选择颜色 ${color}`)}
                          disabled={isSubmitting}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("Cancel", "取消")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Create Collection", "创建收藏夹")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
