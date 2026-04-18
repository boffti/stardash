import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

export type AIProvider = 'openrouter' | 'openai' | 'anthropic'

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openrouter: 'google/gemini-2.0-flash-001',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
}

export interface AIModelConfig {
  model: LanguageModel
  provider: AIProvider
  isUserKey: boolean
}

export function getAIModel(request: Request): AIModelConfig {
  const headerKey = request.headers.get('x-ai-key')
  const headerProvider = (request.headers.get('x-ai-provider') ?? 'openrouter') as AIProvider

  const isUserKey = !!headerKey
  const apiKey = headerKey ?? process.env.OPENROUTER_API_KEY ?? ''

  if (!apiKey) throw new Error('AI service not configured')

  const provider: AIProvider = isUserKey ? headerProvider : 'openrouter'

  switch (provider) {
    case 'openai':
      return { model: createOpenAI({ apiKey })(DEFAULT_MODELS.openai), provider, isUserKey }
    case 'anthropic':
      return { model: createAnthropic({ apiKey })(DEFAULT_MODELS.anthropic), provider, isUserKey }
    default:
      return { model: createOpenRouter({ apiKey })(DEFAULT_MODELS.openrouter), provider, isUserKey }
  }
}
