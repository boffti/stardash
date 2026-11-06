"use client"

import { useI18n } from "@/components/i18n-provider"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Tag, Loader2 } from "lucide-react"

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
import { cn } from "@/lib/utils"

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
    label: z
      .string()
      .min(1, t("Label is required", "请输入标签名称"))
      .max(30, t("Label must be 30 characters or less", "标签名称不能超过 30 个字符")),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, t("Invalid color format", "颜色格式无效")),
  })

type FormData = z.infer<ReturnType<typeof formSchema>>

interface CreateTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (label: string) => Promise<void>
}

function pickTagColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash << 5) - hash + label.charCodeAt(i)
    hash |= 0
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

export function CreateTagModal({ open, onOpenChange, onCreate }: CreateTagModalProps) {
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema(t)),
    defaultValues: {
      label: "",
      color: TAG_PALETTE[0],
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedColor = form.watch("color")

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await onCreate(data.label)
      form.reset()
      onOpenChange(false)
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
            <Tag className="h-5 w-5" />
            {t("Create Tag", "创建标签")}
          </DialogTitle>
          <DialogDescription>
            {t("Create a new tag to categorize your repositories.", "创建标签来分类仓库。")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Label *", "标签名称 *")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., machine-learning"
                      {...field}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        field.onChange(e)
                        form.setValue("color", pickTagColor(e.target.value))
                      }}
                    />
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
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full border"
                      style={{ backgroundColor: selectedColor }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {t("Auto-selected based on label", "根据标签名称自动选择")}
                    </span>
                  </div>
                  <FormControl>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {TAG_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => field.onChange(color)}
                          className={cn(
                            "h-6 w-6 rounded-full transition-all",
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
                {t("Create Tag", "创建标签")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
