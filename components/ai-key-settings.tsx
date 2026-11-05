"use client"

import { useI18n } from "@/components/i18n-provider"
import { useState } from "react"
import { useAIKey, type AIProvider } from "@/lib/use-ai-key"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { KeyRound, Trash2 } from "lucide-react"

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
}

const PROVIDER_PLACEHOLDERS: Record<AIProvider, string> = {
  openrouter: "sk-or-...",
  openai: "sk-...",
  anthropic: "sk-ant-...",
}

export function AIKeySettings() {
  const { t } = useI18n()
  const { config, save, clear } = useAIKey()
  const [provider, setProvider] = useState<AIProvider>(config?.provider ?? "openrouter")
  const [key, setKey] = useState(config?.key ?? "")
  const [showKey, setShowKey] = useState(false)

  const handleSave = () => {
    if (!key.trim()) {
      toast.error(t("Enter an API key", "请输入 API 密钥"))
      return
    }
    save(provider, key.trim())
    toast.success(
      t(
        `${PROVIDER_LABELS[provider]} API key saved`,
        `${PROVIDER_LABELS[provider]} API 密钥已保存`,
      ),
    )
  }

  const handleClear = () => {
    clear()
    setKey("")
    toast.success(t("API key removed", "API 密钥已移除"))
  }

  const maskedKey = config?.key
    ? `${config.key.slice(0, 6)}${"•".repeat(Math.max(0, config.key.length - 10))}${config.key.slice(-4)}`
    : null

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t("AI Provider", "AI 服务商")}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "Optional. The server key (OPENROUTER_API_KEY) is used unless you set your own here. Stored in this browser only and sent with each AI request.",
            "可选。未在此设置时使用服务器密钥（OPENROUTER_API_KEY）。你的密钥仅保存在此浏览器中，并随每次 AI 请求发送。",
          )}
        </p>
      </div>

      {config ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{PROVIDER_LABELS[config.provider]}:</span>
          <span className="font-mono text-xs">{maskedKey}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6 text-muted-foreground hover:text-destructive"
            aria-label={t("Remove API key", "移除 API 密钥")}
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("Provider", "服务商")}</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("API Key", "API 密钥")}</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={PROVIDER_PLACEHOLDERS[provider]}
                className="h-8 text-sm font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs shrink-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? t("Hide", "隐藏") : t("Show", "显示")}
              </Button>
            </div>
          </div>

          <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
            {t("Save key", "保存密钥")}
          </Button>
        </div>
      )}
    </div>
  )
}
