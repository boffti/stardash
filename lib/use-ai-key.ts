'use client'

import { useState, useCallback } from 'react'

export type AIProvider = 'openrouter' | 'openai' | 'anthropic'

export interface AIKeyConfig {
  provider: AIProvider
  key: string
}

const STORAGE_KEY = 'stardash-ai-key'

function readFromStorage(): AIKeyConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AIKeyConfig
  } catch {
    return null
  }
}

export function useAIKey() {
  const [config, setConfig] = useState<AIKeyConfig | null>(() => {
    if (typeof window === 'undefined') return null
    return readFromStorage()
  })

  const save = useCallback((provider: AIProvider, key: string) => {
    const next: AIKeyConfig = { provider, key }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setConfig(next)
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setConfig(null)
  }, [])

  const getHeaders = useCallback((): Record<string, string> => {
    if (!config?.key) return {}
    return {
      'x-ai-provider': config.provider,
      'x-ai-key': config.key,
    }
  }, [config])

  return { config, save, clear, getHeaders }
}
