// Radar scoring. Pure functions only — no I/O — so the check script can run them under plain node.

export type RepoStatus =
  | "want-to-try"
  | "currently-using"
  | "tried-liked"
  | "tried-dropped"
  | "just-interesting"
  | "reference"
  | null

export interface TasteInput {
  topics: string[]
  language: string | null
  status: RepoStatus
  starredAt: string | null
}

export interface TasteProfile {
  topics: Map<string, number>
  languages: Map<string, number>
  maxTopic: number
  maxLanguage: number
  starCount: number
}

export type RadarReasonKind = "following" | "topic" | "language" | "hn" | "velocity" | "new"

export interface RadarReason {
  kind: RadarReasonKind
  text: string
}

export interface RadarHnSource {
  points: number
  title: string
  url: string
}

export interface CandidateInput {
  topics: string[]
  language: string | null
  ghCreatedAt: string | null
  followers: string[]
  hn: RadarHnSource | null
  /** Star count 7 days ago, when a snapshot exists. */
  starsThenWeekAgo: number | null
  stargazersCount: number
}

const STATUS_WEIGHT: Record<Exclude<RepoStatus, null>, number> = {
  "currently-using": 3,
  "tried-liked": 2,
  "want-to-try": 1.5,
  reference: 1.2,
  "just-interesting": 1,
  "tried-dropped": -1.5,
}

const RECENT_STAR_DAYS = 90
const DAY_MS = 86_400_000

function bump(map: Map<string, number>, key: string, weight: number) {
  map.set(key, (map.get(key) ?? 0) + weight)
}

export function buildTasteProfile(stars: TasteInput[], now = Date.now()): TasteProfile {
  const topics = new Map<string, number>()
  const languages = new Map<string, number>()

  for (const star of stars) {
    const base = star.status ? STATUS_WEIGHT[star.status] : 1
    const starredMs = star.starredAt ? Date.parse(star.starredAt) : NaN
    const recent = Number.isFinite(starredMs) && now - starredMs < RECENT_STAR_DAYS * DAY_MS
    const weight = base * (recent ? 1.5 : 1)

    for (const topic of star.topics) bump(topics, topic.toLowerCase(), weight)
    if (star.language) bump(languages, star.language.toLowerCase(), weight)
  }

  const maxTopic = Math.max(1, ...topics.values())
  const maxLanguage = Math.max(1, ...languages.values())
  return { topics, languages, maxTopic, maxLanguage, starCount: stars.length }
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n)
}

function listPeople(logins: string[]): string {
  if (logins.length === 1) return `${logins[0]} starred this`
  if (logins.length === 2) return `${logins[0]} and ${logins[1]} starred this`
  return `${logins[0]}, ${logins[1]} and ${logins.length - 2} more you follow starred this`
}

export function scoreCandidate(
  c: CandidateInput,
  profile: TasteProfile,
  now = Date.now(),
): { score: number; reasons: RadarReason[] } {
  const reasons: RadarReason[] = []
  let score = 0

  // Social: strongest signal. log2 so 1 person = 2.25, 3 people = 4.5, 7 people = 6.75 (cap). Outranks a full topic+language match (~4).
  if (c.followers.length > 0) {
    score += Math.min(3, Math.log2(1 + c.followers.length)) * 2.25
    reasons.push({ kind: "following", text: listPeople(c.followers) })
  }

  // Topic overlap, normalized to the user's strongest topic. Negative weights (tried-dropped) subtract.
  const matched = c.topics
    .map((t) => ({ topic: t, w: profile.topics.get(t.toLowerCase()) ?? 0 }))
    .filter((m) => m.w !== 0)
    .sort((a, b) => b.w - a.w)
  const positive = matched.filter((m) => m.w > 0).slice(0, 3)
  const negative = matched.filter((m) => m.w < 0)
  for (const m of positive) score += Math.min(1, m.w / profile.maxTopic) * 1.5
  for (const m of negative) score += Math.max(-1, m.w / profile.maxTopic) * 1.5
  if (positive.length > 0) {
    reasons.push({
      kind: "topic",
      text: `Matches ${positive.map((m) => m.topic).join(", ")} in your stars`,
    })
  }

  if (c.language) {
    const w = profile.languages.get(c.language.toLowerCase()) ?? 0
    if (w > 0) {
      const share = Math.min(1, w / profile.maxLanguage)
      score += share * 1.5
      if (share >= 0.5) reasons.push({ kind: "language", text: `${c.language}, your usual` })
    }
  }

  if (c.hn) {
    score += c.hn.points >= 100 ? 2 : 1.2
    reasons.push({ kind: "hn", text: `${c.hn.points} points on Hacker News` })
  }

  if (c.starsThenWeekAgo !== null && c.starsThenWeekAgo > 0) {
    const delta = c.stargazersCount - c.starsThenWeekAgo
    const ratio = delta / c.starsThenWeekAgo
    if (delta >= 100 && ratio >= 0.1) {
      score += Math.min(2, ratio * 4)
      reasons.push({ kind: "velocity", text: `+${formatCount(delta)} stars this week` })
    }
  }

  const createdMs = c.ghCreatedAt ? Date.parse(c.ghCreatedAt) : NaN
  if (Number.isFinite(createdMs) && now - createdMs < 7 * DAY_MS) {
    score += 0.75
    reasons.push({ kind: "new", text: "Created this week" })
  }

  return { score: Math.round(score * 100) / 100, reasons }
}
