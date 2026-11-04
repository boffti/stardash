import { NextResponse } from "next/server"
import { after } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { getUser } from "@/lib/auth"
import { db, nowIso, toJson } from "@/lib/db"
import { getValidGitHubToken } from "@/lib/tokens"
import {
  fetchRepoCommunityFileSignals,
  fetchRepoIntelData,
  GitHubRateLimitError,
} from "@/lib/repo-intel"
import { analyzeRepoIntel, getCachedInsight, saveRepoInsight } from "@/lib/ai-repo-intel"
import { agentWatching, latestRequest, queueRequest } from "@/lib/agent-requests"
import { langfuseSpanProcessor } from "@/instrumentation"
import { getAIModel, getProviderOptions, hasAIKey, type AIModelConfig } from "@/lib/ai-provider"
import { checkAndIncrementWeeklyLimit, type WeeklyLimitResult } from "@/lib/ai-weekly-limit"
import type { RepoIntel } from "@/lib/types"
import { type RepoInsightRow, rowToIntel } from "@/lib/repo-insight-row"

export const maxDuration = 60

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function communityFilesChanged(
  current: RepoIntel["metrics"]["hasCommunityFiles"],
  next: RepoIntel["metrics"]["hasCommunityFiles"],
) {
  return Object.entries(next).some(([key, value]) => {
    return current[key as keyof RepoIntel["metrics"]["hasCommunityFiles"]] !== value
  })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const owner = searchParams.get("owner")
    const repo = searchParams.get("repo")
    const refresh = searchParams.get("refresh") === "true"

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner or repo" }, { status: 400 })
    }

    const repoFullName = `${owner}/${repo}`

    const user = await getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check global cache
    const cached = getCachedInsight(repoFullName)

    // No AI key: the user's own agent does the analysis (lib/agent-requests.ts).
    // Polling this URL without refresh reports the request until it lands.
    if (!hasAIKey(request)) {
      const intel = cached ? rowToIntel(cached) : undefined
      const last = latestRequest(user.id, "intel", repoFullName)
      const agent = { watching: agentWatching(user.id) }
      const lastIsNewer = last && (!cached || last.created_at > cached.analyzed_at)
      if (last && (last.status === "queued" || last.status === "claimed")) {
        return NextResponse.json({ intel, cached: !!intel, request: last, agent })
      }
      if (!refresh && (intel || last?.status === "failed")) {
        return NextResponse.json({
          intel,
          cached: !!intel,
          request: lastIsNewer ? last : undefined,
          agent,
        })
      }
      const { token, error: tokenError } = await getValidGitHubToken()
      if (tokenError === "expired") {
        return NextResponse.json(
          { error: "GitHub token expired. Please sign out and sign in again." },
          { status: 401 },
        )
      }
      const raw = await fetchRepoIntelData(owner, repo, token ?? undefined)
      const queued = queueRequest(user.id, "intel", repoFullName, {
        repoFullName,
        metrics: raw.metrics,
        issueSamples: raw.issueSamples,
        contributorCount: raw.contributorCount,
      })
      return NextResponse.json({ intel, cached: !!intel, request: queued, agent })
    }

    // Return fresh cached data without hitting rate limit
    if (cached && !refresh) {
      const age = Date.now() - new Date(cached.analyzed_at).getTime()
      if (age < CACHE_TTL_MS) {
        const intel = rowToIntel(cached)

        after(async () => {
          try {
            const tokenResult = await getValidGitHubToken()
            const token =
              tokenResult.error === "expired" ? undefined : (tokenResult.token ?? undefined)

            if (!token) return

            const hasCommunityFiles = await fetchRepoCommunityFileSignals(owner, repo, token)
            const metrics = {
              ...intel.metrics,
              hasCommunityFiles: {
                ...intel.metrics.hasCommunityFiles,
                ...hasCommunityFiles,
              },
            }

            if (communityFilesChanged(intel.metrics.hasCommunityFiles, metrics.hasCommunityFiles)) {
              db.prepare("update repo_insights set metrics = ? where repo_full_name = ?").run(
                toJson(metrics),
                repoFullName,
              )
            }
          } catch (error) {
            Sentry.captureException(error, {
              tags: {
                route: "app/api/ai/repo-intel",
                repoFullName,
                backgroundTask: "refreshRepoCommunityFileSignals",
              },
            })
          }
        })

        return NextResponse.json({
          intel,
          cached: true,
        })
      }
    }

    // Use a GitHub token when present, but allow public repositories to be analyzed
    // without one. Cached DB intel above never depends on GitHub auth.
    const { token, error: tokenError } = await getValidGitHubToken()
    if (tokenError === "expired") {
      return NextResponse.json(
        { error: "GitHub token expired. Please sign out and sign in again." },
        { status: 401 },
      )
    }

    // Get AI model config
    let modelConfig: AIModelConfig
    try {
      modelConfig = getAIModel(request)
    } catch {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 })
    }

    // Enforce per-user weekly limit only when using server key
    let limitResult: WeeklyLimitResult | undefined
    if (!modelConfig.isUserKey) {
      limitResult = await checkAndIncrementWeeklyLimit(user.id, "intel")
      if (!limitResult.allowed) {
        if (cached) {
          return NextResponse.json({
            intel: rowToIntel(cached),
            cached: true,
            limitReached: true,
            nextAllowedAt: limitResult.nextAllowedAt,
          })
        }
        const msg =
          limitResult.limitType === "daily"
            ? "Daily AI limit reached. Try again tomorrow."
            : "Weekly AI limit reached. Try again next week."
        return NextResponse.json(
          { error: msg, remaining: 0, nextAllowedAt: limitResult.nextAllowedAt },
          { status: 429 },
        )
      }
    }

    // Fetch GitHub data
    const rawData = await fetchRepoIntelData(owner, repo, token ?? undefined)

    // AI synthesis
    const analysis = await analyzeRepoIntel(
      {
        repoFullName,
        metrics: rawData.metrics,
        issueSamples: rawData.issueSamples,
        contributorCount: rawData.contributorCount,
      },
      modelConfig.model,
      getProviderOptions(modelConfig.provider),
    )

    // Upsert to global cache
    let upserted: RepoInsightRow | undefined
    try {
      upserted = saveRepoInsight(repoFullName, analysis)
    } catch (upsertError) {
      Sentry.captureException(upsertError)
    }

    if (!upserted) {
      // Return the analysis even if caching failed
      const intel: RepoIntel = {
        id: crypto.randomUUID(),
        repoFullName,
        analyzedAt: nowIso(),
        ...analysis,
      }
      return NextResponse.json({ intel, cached: false, remaining: limitResult?.remaining ?? null })
    }

    after(async () => {
      await langfuseSpanProcessor?.forceFlush()
    })

    return NextResponse.json({
      intel: rowToIntel(upserted),
      cached: false,
      remaining: limitResult?.remaining ?? null,
    })
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: "GitHub API rate limit reached. Please wait a few minutes and try again." },
        { status: 429 },
      )
    }
    Sentry.captureException(err)
    console.error("[repo-intel] error:", err)
    return NextResponse.json(
      { error: "Failed to analyze repository. Please try again." },
      { status: 500 },
    )
  }
}
