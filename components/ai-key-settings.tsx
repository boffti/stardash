"use client"

import { useI18n } from "@/components/i18n-provider"
import { useEffect, useState } from "react"
import { useAIKey, type AIKeyConfig, type AIProvider } from "@/lib/use-ai-key"
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
import { Trash2 } from "lucide-react"

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
  const [draft, setDraft] = useState<Partial<AIKeyConfig> | null>(null)
  const [showKey, setShowKey] = useState(false)
  const provider = draft?.provider ?? config?.provider ?? "openrouter"
  const key = draft?.key ?? config?.key ?? ""
  const baseURL = draft?.baseURL ?? config?.baseURL ?? "http://localhost:11434/v1"
  const model = draft?.model ?? config?.model ?? ""
  const [models, setModels] = useState<string[]>([])
  const [modelsError, setModelsError] = useState("")
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelFilter, setModelFilter] = useState("")

  const ready = provider === "ollama" || key.trim().length >= 8

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const handle = window.setTimeout(() => {
      setLoadingModels(true)
      setModelsError("")
      fetch("/api/ai/models", {
        signal: controller.signal,
        headers: {
          "x-ai-provider": provider,
          ...(key.trim() ? { "x-ai-key": key.trim() } : {}),
          ...(provider === "ollama" ? { "x-ai-base-url": baseURL } : {}),
        },
      })
        .then(async (response) => {
          const body = (await response.json()) as { models?: string[]; error?: string }
          if (!response.ok) throw new Error(body.error || "Could not load models")
          setModels(body.models ?? [])
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return
          setModels([])
          setModelsError(err.message)
        })
        .finally(() => setLoadingModels(false))
    }, 400)
    return () => {
      window.clearTimeout(handle)
      controller.abort()
    }
  }, [provider, key, baseURL, ready])

  function edit(patch: Partial<AIKeyConfig>) {
    const nextProvider = patch.provider ?? provider
    setDraft({
      key,
      baseURL,
      model: patch.provider && patch.provider !== provider ? "" : model,
      ...patch,
      provider: nextProvider,
    })
  }

  const handleSave = () => {
    if (provider !== "ollama" && !key.trim()) {
      toast.error(t("Enter an API key", "请输入 API 密钥"))
      return
    }
    if (!model.trim()) {
      toast.error(t("Choose a model", "请选择模型"))
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
      model.trim(),
      provider === "ollama" ? baseURL.trim() : undefined,
    )
    toast.success(
      t(`${PROVIDER_LABELS[provider]} settings saved`, `${PROVIDER_LABELS[provider]} 设置已保存`),
    )
  }

  const handleClear = () => {
    clear()
    setDraft(null)
    toast.success(t("AI settings removed", "AI 设置已移除"))
  }

  const listed = ready ? models : []
  const options = model && !listed.includes(model) ? [model, ...listed] : listed
  const visibleModels = (
    modelFilter.trim()
      ? options.filter((id) => id.toLowerCase().includes(modelFilter.trim().toLowerCase()))
      : options
  ).slice(0, 50)

  const control = "h-8 w-72 max-w-[50%] text-[13px] shadow-none"

  return (
    <div className="w-full divide-y divide-border/60 overflow-hidden rounded-lg bg-muted">
      <div className="flex h-12 items-center justify-between gap-4 px-3">
        <Label htmlFor="ai-provider" className="text-[13px] font-normal">
          {t("Provider", "服务商")}
        </Label>
        <Select value={provider} onValueChange={(value) => edit({ provider: value as AIProvider })}>
          <SelectTrigger id="ai-provider" className={control}>
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
        <div className="flex h-12 items-center justify-between gap-4 px-3">
          <Label htmlFor="ai-api-key" className="shrink-0 text-[13px] font-normal">
            {t("API key", "API 密钥")}
          </Label>
          <div className="flex w-72 max-w-[50%] items-center gap-1">
            <Input
              id="ai-api-key"
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => edit({ key: e.target.value })}
              placeholder={PROVIDER_PLACEHOLDERS[provider]}
              className="h-8 font-mono text-[13px] shadow-none"
            />
            <Button
              variant="outline"
              className="h-8 shrink-0 px-2 text-[13px] shadow-none"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? t("Hide", "隐藏") : t("Show", "显示")}
            </Button>
          </div>
        </div>
      )}

      {provider === "ollama" && (
        <div className="flex h-12 items-center justify-between gap-4 px-3">
          <Label htmlFor="ollama-url" className="shrink-0 text-[13px] font-normal">
            {t("Server", "地址")}
          </Label>
          <Input
            id="ollama-url"
            value={baseURL}
            onChange={(e) => edit({ baseURL: e.target.value })}
            className={control}
          />
        </div>
      )}

      <div className="flex h-12 items-center justify-between gap-4 px-3">
        <Label htmlFor="ai-model-filter" className="shrink-0 text-[13px] font-normal">
          {t("Filter", "筛选")}
        </Label>
        <Input
          id="ai-model-filter"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          placeholder={t("Filter model ids", "筛选模型 ID")}
          className={control}
          disabled={loadingModels || models.length === 0}
        />
      </div>

      <div className="flex h-12 items-center justify-between gap-4 px-3">
        <div className="min-w-0">
          <Label htmlFor="ai-model" className="text-[13px] font-normal">
            {t("Model", "模型")}
          </Label>
          {ready && modelsError && (
            <p className="truncate text-xs text-destructive">{modelsError}</p>
          )}
        </div>
        <Select
          value={model || undefined}
          onValueChange={(value) => edit({ model: value })}
          disabled={loadingModels || options.length === 0}
        >
          <SelectTrigger id="ai-model" className={control}>
            <SelectValue
              placeholder={
                loadingModels
                  ? t("Loading models", "正在读取模型")
                  : t("Choose a model", "选择模型")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {visibleModels.map((id) => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-12 items-center justify-end gap-2 px-3">
        {config && (
          <Button
            variant="ghost"
            className="h-7 px-2.5 text-[13px] text-muted-foreground shadow-none"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("Remove", "移除")}
          </Button>
        )}
        <Button
          variant="outline"
          className="h-7 px-2.5 text-[13px] shadow-none"
          onClick={handleSave}
        >
          {t("Save", "保存")}
        </Button>
      </div>
    </div>
  )
}
