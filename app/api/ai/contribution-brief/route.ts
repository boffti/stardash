import { NextResponse } from 'next/server'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { langfuseSpanProcessor } from '@/instrumentation'
import type { ContributionOpportunity } from '@/lib/contribution-opportunities'
import { getAIModel, getProviderOptions, type AIModelConfig } from '@/lib/ai-provider'
import { checkAndIncrementWeeklyLimit } from '@/lib/ai-weekly-limit'

export const maxDuration = 45

const ContributionBriefSchema = z.object({
  summary: z.string().describe('A concise plain-English explanation of the issue.'),
  whyItFits: z.array(z.string()).min(2).max(4),
  firstSteps: z.array(z.string()).min(3).max(5),
  likelyFiles: z.array(z.string()).min(1).max(5),
  questionsToAsk: z.array(z.string()).min(1).max(3),
  codingAssistantPrompt: z.string().describe('A ready-to-use prompt for a coding assistant.'),
})

interface RequestBody {
  opportunity?: ContributionOpportunity
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let modelConfig: AIModelConfig
    try {
      modelConfig = getAIModel(request)
    } catch {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    const { opportunity } = (await request.json()) as RequestBody
    if (!opportunity) {
      return NextResponse.json({ error: 'Missing opportunity' }, { status: 400 })
    }

    let limitResult: Awaited<ReturnType<typeof checkAndIncrementWeeklyLimit>> | undefined
    if (!modelConfig.isUserKey) {
      limitResult = await checkAndIncrementWeeklyLimit(user.id, 'brief')
      if (!limitResult.allowed) {
        const msg = limitResult.limitType === 'daily'
          ? 'Daily AI brief limit reached. Try again tomorrow.'
          : 'Weekly AI brief limit reached. Try again next week.'
        return NextResponse.json(
          { error: msg, remaining: 0, nextAllowedAt: limitResult.nextAllowedAt },
          { status: 429 },
        )
      }
    }

    const { object } = await generateObject({
      model: modelConfig.model,
      schema: ContributionBriefSchema,
      providerOptions: getProviderOptions(modelConfig.provider),
      experimental_telemetry: { isEnabled: true, functionId: 'contribution-brief' },
      system: `You help developers evaluate open-source issues before they start work.
Be practical and careful. Do not claim you inspected the repository code. Base your answer only on the issue metadata, repository metadata, labels, and description preview.
Use concise language. When uncertain, frame suggestions as likely starting points or questions.`,
      prompt: JSON.stringify({
        repo: {
          fullName: opportunity.repoFullName,
          description: opportunity.repoDescription,
          language: opportunity.repoLanguage,
          topics: opportunity.repoTopics,
        },
        issue: {
          number: opportunity.issueNumber,
          title: String(opportunity.title ?? '').slice(0, 200),
          bodyPreview: String(opportunity.bodyPreview ?? '').slice(0, 2000),
          labels: opportunity.labels,
          difficulty: opportunity.difficulty,
          contributionTypes: opportunity.contributionTypes,
          risks: opportunity.risks,
        },
      }),
    })

    after(async () => {
      await langfuseSpanProcessor?.forceFlush()
    })

    return NextResponse.json({ brief: object, remaining: limitResult?.remaining ?? null })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[contribution-brief] error:', error)
    return NextResponse.json({ error: 'Failed to generate contribution brief' }, { status: 500 })
  }
}
