'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type AIProvider = 'openrouter' | 'openai' | 'anthropic'

export interface AIKeyConfig {
  provider: AIProvider
  key: string
}

const STORAGE_KEY = 'stardash-ai-key'
const STORAGE_EVENT = 'stardash-ai-key-updated'

let cachedRaw: string | null | undefined
let cachedConfig: AIKeyConfig | null = null

function parseStoredConfig(raw: string | null): AIKeyConfig | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as AIKeyConfig
  } catch {
    return null
  }
}

function readFromStorage(): AIKeyConfig | null {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedConfig

  cachedRaw = raw
  cachedConfig = parseStoredConfig(raw)
  return cachedConfig
}

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(STORAGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(STORAGE_EVENT, onStoreChange)
  }
}

function emitStorageChange() {
  window.dispatchEvent(new Event(STORAGE_EVENT))
}

export function useAIKey() {
  const config = useSyncExternalStore(subscribeToStorage, readFromStorage, () => null)

  const save = useCallback((provider: AIProvider, key: string) => {
    const next: AIKeyConfig = { provider, key }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    emitStorageChange()
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    emitStorageChange()
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
