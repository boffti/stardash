export interface RepoUserMeta {
  dbId: string
  status: RepoStatus | null
  isPinned: boolean
  notes: string | null
  tagIds: string[]
  collectionIds: string[]
}

export interface UserMetadata {
  tags: Tag[]
  collections: Collection[]
  repoMeta: Record<string, RepoUserMeta>
}

export interface CategorizationResult {
  collections: Collection[]
  allTags: Tag[]
  repoTags: Record<string, Tag[]>
  repoCollections: Record<string, string[]>
  generatedAt: string
  categorizedRepoCount?: number
}

export type RepoStatus =
  | 'want-to-try'
  | 'currently-using'
  | 'tried-liked'
  | 'tried-dropped'
  | 'just-interesting'
  | 'reference'
  | null

export interface Tag {
  id: string
  label: string
  color: string
}

export interface Collection {
  id: string
  name: string
  emoji: string
  color: string
  repoCount: number
}

export interface StarredRepo {
  id: string
  owner: string
  name: string
  fullName: string
  description: string
  language: string | null
  languageColor: string | null
  topics: string[]
  homepage: string | null
  license: string | null
  stargazersCount: number
  forksCount: number
  openIssuesCount: number
  pushedAt: string
  starredAt: string
  avatarUrl: string
  status: RepoStatus
  isPinned: boolean
  notes: string | null
  tags: Tag[]
  collections: string[]
  readme: string | null
  archived?: boolean
  // Health signal fields (computed from snapshots/releases)
  isTrending?: boolean // Stars doubled in 30 days
  latestRelease?: {
    tagName: string
    name: string
    publishedAt: string
    htmlUrl: string
  } | null
}

export type MaintenanceVerdict =
  | 'actively-maintained'
  | 'lightly-maintained'
  | 'stale'
  | 'abandoned'

export type MaintenanceSignalStrength = 'strong' | 'ok' | 'weak' | 'bad' | 'unknown'

export interface RepoMaintenanceAssessment {
  verdict: MaintenanceVerdict
  confidence: number
  score: number
  reasons: string[]
  signals: {
    commitRecency: MaintenanceSignalStrength
    commitVelocity: MaintenanceSignalStrength
    issueResponsiveness: MaintenanceSignalStrength
    prActivity: MaintenanceSignalStrength
    releaseRecency: MaintenanceSignalStrength
  }
}

export type CommunitySentiment = 'positive' | 'mixed' | 'frustrated'

export type AdoptionReadiness =
  | 'production-ready'
  | 'maturing'
  | 'experimental'
  | 'deprecated'

export interface RepoIntelMetrics {
  issueCloseRate: number          // 0–1
  avgIssueResponseDays: number | null // Deprecated name: median days from issue creation to close.
  medianIssueCloseDays?: number | null
  staleIssueCount: number
  prMergeRate: number             // 0–1
  avgPrMergeDays: number | null
  stalePrCount?: number | null
  activeContributors90d: number   // Deprecated proxy kept for cached insight compatibility.
  topContributorCount?: number
  topContributorShare?: number
  topThreeContributorShare?: number
  commits30d?: number
  commits90d?: number
  activeCommitAuthors90d?: number
  daysSinceLastCommit: number | null
  daysSinceLastRelease: number | null
  releases6mo?: number
  releases12mo?: number
  releaseCadenceDays?: number | null
  maintenanceAssessment?: RepoMaintenanceAssessment
  hasCommunityFiles: {
    contributingGuide: boolean
    codeOfConduct: boolean
    ci: boolean
    securityPolicy?: boolean
    issueTemplate?: boolean
    pullRequestTemplate?: boolean
    license?: boolean
    readme?: boolean
  }
}

export interface IntelSubScores {
  maintenance: number  // 0–100
  activity: number     // 0–100
  community: number    // 0–100
  trust: number        // 0–100 (100 = low risk / high trust)
}

export interface RepoIntel {
  id: string
  repoFullName: string
  analyzedAt: string
  healthScore: number
  maintenanceVerdict: MaintenanceVerdict
  communitySentiment: CommunitySentiment
  adoptionReadiness: AdoptionReadiness
  topPainPoints: string[]
  summary: string
  recommendation: string
  metrics: RepoIntelMetrics
}

export const STATUS_LABELS: Record<Exclude<RepoStatus, null>, { label: string; color: string }> = {
  'want-to-try': { label: 'Want to Try', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'currently-using': { label: 'Currently Using', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'tried-liked': { label: 'Tried - Liked', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  'tried-dropped': { label: 'Tried - Dropped', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  'just-interesting': { label: 'Just Interesting', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  'reference': { label: 'Reference', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
}

export const LANGUAGE_COLORS: Record<string, string> = {
  'TypeScript': '#3178c6',
  'JavaScript': '#f7df1e',
  'Python': '#3572A5',
  'Rust': '#dea584',
  'Go': '#00ADD8',
  'Java': '#b07219',
  'C++': '#f34b7d',
  'C': '#555555',
  'Ruby': '#701516',
  'PHP': '#4F5D95',
  'Swift': '#F05138',
  'Kotlin': '#A97BFF',
  'Shell': '#89e051',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'Vue': '#41b883',
  'Svelte': '#ff3e00',
  'Dart': '#00B4AB',
  'Scala': '#c22d40',
  'Elixir': '#6e4a7e',
}
