'use client'

import { useState } from 'react'
import { useAIKey, type AIProvider } from '@/lib/use-ai-key'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { KeyRound, Trash2 } from 'lucide-react'

const PROVIDER_LABELS: Record<AIProvider, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

const PROVIDER_PLACEHOLDERS: Record<AIProvider, string> = {
  openrouter: 'sk-or-...',
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
}

export function AIKeySettings() {
  const { config, save, clear } = useAIKey()
  const [provider, setProvider] = useState<AIProvider>(config?.provider ?? 'openrouter')
  const [key, setKey] = useState(config?.key ?? '')
  const [showKey, setShowKey] = useState(false)

  const handleSave = () => {
    if (!key.trim()) {
      toast.error('Enter an API key')
      return
    }
    save(provider, key.trim())
    toast.success(`${PROVIDER_LABELS[provider]} API key saved`)
  }

  const handleClear = () => {
    clear()
    setKey('')
    toast.success('API key removed')
  }

  const maskedKey = config?.key
    ? `${config.key.slice(0, 6)}${'•'.repeat(Math.max(0, config.key.length - 10))}${config.key.slice(-4)}`
    : null

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">AI Provider</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Supply your own API key to remove usage limits. Stored locally in your browser only.
          Falls back to the built-in key (with limits) when none is set.
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
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Provider</Label>
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
            <Label className="text-xs">API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
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
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>

          <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
            Save key
          </Button>
        </div>
      )}
    </div>
  )
}
