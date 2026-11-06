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
  deepseek: "DeepSeek",
  ollama: "Ollama",
}

const PROVIDER_PLACEHOLDERS: Record<AIProvider, string> = {
  openrouter: "sk-or-...",
  openai: "sk-...",
  anthropic: "sk-ant-...",
  deepseek: "sk-...",
  ollama: "",
}

export function AIKeySettings() {
  const { t } = useI18n()
  const { config, save, clear } = useAIKey()
  const [provider, setProvider] = useState<AIProvider>(config?.provider ?? "openrouter")
  const [key, setKey] = useState(config?.key ?? "")
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState("")
  const [baseURL, setBaseURL] = useState("http://localhost:11434/v1")

  const handleSave = () => {
    if (provider !== "ollama" && !key.trim()) {
      toast.error(t("Enter an API key", "请输入 API 密钥"))
      return
    }
    if (provider === "ollama" && !model.trim()) {
      toast.error(t("Enter an Ollama model", "请输入 Ollama 模型"))
      return
    }
    if (provider === "ollama") {
      try {
        const url = new URL(baseURL)
        if (
          !["http:", "https:"].includes(url.protocol) ||
          !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
          url.username ||
          url.password
        )
          throw new Error()
      } catch {
        toast.error(t("Enter a loopback Ollama URL", "请输入本机 Ollama 地址"))
        return
      }
    }
    save(
      provider,
      provider === "ollama" ? "" : key.trim(),
      model.trim() || undefined,
      provider === "ollama" ? baseURL.trim() : undefined,
    )
    toast.success(
      t(`${PROVIDER_LABELS[provider]} settings saved`, `${PROVIDER_LABELS[provider]} 设置已保存`),
    )
  }

  const handleClear = () => {
    clear()
    setKey("")
    toast.success(t("AI settings removed", "AI 设置已移除"))
  }

  const maskedKey = config?.key
    ? `${config.key.slice(0, 6)}${"•".repeat(Math.max(0, config.key.length - 10))}${config.key.slice(-4)}`
    : null

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{t("AI Provider", "AI 服务商")}</h2>

      {config ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{PROVIDER_LABELS[config.provider]}:</span>
          <span className="font-mono text-xs">{maskedKey || config.model}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6 text-muted-foreground hover:text-destructive"
            aria-label={t("Remove AI settings", "移除 AI 设置")}
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="max-w-md space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider" className="text-xs">
              {t("Provider", "服务商")}
            </Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
              <SelectTrigger id="ai-provider" className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider !== "ollama" && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-api-key" className="text-xs">
                {t("API key", "API 密钥")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="ai-api-key"
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
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-model" className="text-xs">
              {t("Model", "模型")}
            </Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={
                provider === "ollama" ? "qwen3:8b" : t("Provider default", "服务商默认模型")
              }
              className="h-8 text-sm"
            />
          </div>
          {provider === "ollama" && (
            <div className="space-y-1.5">
              <Label htmlFor="ollama-url" className="text-xs">
                {t("Server loopback URL", "服务器本机地址")}
              </Label>
              <Input
                id="ollama-url"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}

          <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
            {t("Save settings", "保存设置")}
          </Button>
        </div>
      )}
    </section>
  )
}
