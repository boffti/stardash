import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import {
  buildTasteProfile,
  scoreCandidate,
  type RadarHnSource,
  type RadarReason,
  type RepoStatus,
} from "@/lib/radar"
import { RADAR_ENABLED } from "@/lib/flags"

export interface RadarItem {
  id: number
  fullName: string
  name: string
  owner: string
  avatarUrl: string
  description: string | null
  stargazersCount: number
  forksCount: number
  language: string | null
  topics: string[]
  pushedAt: string
  htmlUrl: string
  ghCreatedAt: string | null
  firstSeenAt: string
  starsDelta7d: number | null
  followers: string[]
  hn: RadarHnSource | null
  score: number
  reasons: RadarReason[]
  // SearchRepo compatibility so the existing star popover works unchanged.
  evidence: string[]
  relevanceScore: number
}

export interface RadarResponse {
  items: RadarItem[]
  total: number
  scannedAt: string | null
  starCount: number
}

const WINDOW_DAYS = 14
const MAX_CANDIDATES = 600
const MAX_ITEMS = 80

interface CandidateRow {
  github_repo_id: number
  owner: string
  name: string
  full_name: string
  description: string | null
  language: string | null
  topics: string[]
  stargazers_count: number
  forks_count: number
  pushed_at: string | null
  gh_created_at: string | null
  avatar_url: string | null
  html_url: string
  sources: { new?: boolean; hn?: RadarHnSource }
  first_seen_at: string
  last_seen_at: string
}

interface StarRow {
  status: RepoStatus
  starred_at: string | null
  repos: { github_repo_id: number; topics: string[]; language: string | null } | null
}

export async function GET() {
  if (!RADAR_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 })
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
    const weekAgo = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)

    const [starsRes, candidatesRes, signalsRes, actionsRes] = await Promise.all([
      supabase
        .from("user_starred_repos")
        .select("status, starred_at, repos!inner(github_repo_id, topics, language)")
        .eq("user_id", user.id),
      supabase
        .from("radar_candidates")
        .select("*")
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false })
        .limit(MAX_CANDIDATES),
      supabase
        .from("radar_signals")
        .select("github_repo_id, actor_login")
        .eq("user_id", user.id)
        .gte("seen_at", since),
      supabase.from("radar_actions").select("github_repo_id, action, until").eq("user_id", user.id),
    ])
    const firstError = starsRes.error || candidatesRes.error || signalsRes.error || actionsRes.error
    if (firstError) throw firstError

    const stars = (starsRes.data ?? []) as unknown as StarRow[]
    const starredIds = new Set(stars.map((s) => Number(s.repos?.github_repo_id)))
    const profile = buildTasteProfile(
      stars.map((s) => ({
        topics: s.repos?.topics ?? [],
        language: s.repos?.language ?? null,
        status: s.status,
        starredAt: s.starred_at,
      })),
    )

    const hidden = new Set<number>()
    for (const a of actionsRes.data ?? []) {
      if (a.action === "snoozed" && a.until && Date.parse(a.until) < Date.now()) continue
      hidden.add(Number(a.github_repo_id))
    }

    const followersByRepo = new Map<number, string[]>()
    for (const s of signalsRes.data ?? []) {
      const id = Number(s.github_repo_id)
      followersByRepo.set(id, [...(followersByRepo.get(id) ?? []), s.actor_login])
    }

    const candidates = ((candidatesRes.data ?? []) as CandidateRow[]).filter(
      (c) => !starredIds.has(Number(c.github_repo_id)) && !hidden.has(Number(c.github_repo_id)),
    )

    // Socially-signalled repos may be older than the window; pull them in too.
    const missingSocial = [...followersByRepo.keys()].filter(
      (id) =>
        !starredIds.has(id) &&
        !hidden.has(id) &&
        !candidates.some((c) => Number(c.github_repo_id) === id),
    )
    if (missingSocial.length > 0) {
      const { data: extra } = await supabase
        .from("radar_candidates")
        .select("*")
        .in("github_repo_id", missingSocial.slice(0, 200))
      candidates.push(...((extra ?? []) as CandidateRow[]))
    }

    const ids = candidates.map((c) => Number(c.github_repo_id))
    const starsWeekAgo = new Map<number, number>()
    if (ids.length > 0) {
      const { data: snapshots } = await supabase
        .from("repo_star_snapshots")
        .select("repo_github_id, star_count, snapshot_date")
        .in("repo_github_id", ids)
        .gte("snapshot_date", weekAgo)
        .order("snapshot_date", { ascending: true })
      for (const s of snapshots ?? []) {
        const id = Number(s.repo_github_id)
        if (!starsWeekAgo.has(id)) starsWeekAgo.set(id, s.star_count)
      }
    }

    const items: RadarItem[] = candidates
      .map((c) => {
        const id = Number(c.github_repo_id)
        const followers = followersByRepo.get(id) ?? []
        const hn = c.sources?.hn ?? null
        const then = starsWeekAgo.get(id) ?? null
        const { score, reasons } = scoreCandidate(
          {
            topics: c.topics ?? [],
            language: c.language,
            ghCreatedAt: c.gh_created_at,
            followers,
            hn,
            starsThenWeekAgo: then,
            stargazersCount: c.stargazers_count,
          },
          profile,
        )
        return {
          id,
          fullName: c.full_name,
          name: c.name,
          owner: c.owner,
          avatarUrl: c.avatar_url ?? "",
          description: c.description,
          stargazersCount: c.stargazers_count,
          forksCount: c.forks_count,
          language: c.language,
          topics: c.topics ?? [],
          pushedAt: c.pushed_at ?? c.last_seen_at,
          htmlUrl: c.html_url,
          ghCreatedAt: c.gh_created_at,
          firstSeenAt: c.first_seen_at,
          starsDelta7d: then !== null ? c.stargazers_count - then : null,
          followers,
          hn,
          score,
          reasons,
          evidence: reasons.map((r) => r.text),
          relevanceScore: score,
        }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.stargazersCount - a.stargazersCount)

    const scannedAt = candidates.reduce<string | null>(
      (max, c) => (!max || c.last_seen_at > max ? c.last_seen_at : max),
      null,
    )

    const body: RadarResponse = {
      items: items.slice(0, MAX_ITEMS),
      total: items.length,
      scannedAt,
      starCount: stars.length,
    }
    return NextResponse.json(body)
  } catch (err) {
    Sentry.captureException(err)
    console.error("Radar error:", err)
    return NextResponse.json({ error: "Radar failed" }, { status: 500 })
  }
}
