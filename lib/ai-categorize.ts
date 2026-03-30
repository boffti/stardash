import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { StarredRepo, Tag, Collection, CategorizationResult } from './types'

const COLLECTION_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#0ea5e9', '#d946ef', '#64748b',
]

const TAG_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1',
]

function hashColor(str: string, palette: string[]): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return palette[Math.abs(hash) % palette.length]
}

// Phase 1: generate collection taxonomy + shared tag vocabulary
const TaxonomySchema = z.object({
  collections: z.array(z.object({
    id: z.string().describe('URL-safe slug e.g. "ai-ml-tools"'),
    name: z.string().max(22).describe('Human-readable name, max 22 characters e.g. "AI & ML", "Frontend", "CLI Tools", "DevOps"'),
    emoji: z.string().describe('Single emoji representing the collection'),
  })),
  tags: z.array(z.string()).describe('Shared vocabulary of 15-25 lowercase hyphenated tags'),
})

// Phase 2: classify a batch of repos using the established taxonomy
const RepoBatchSchema = z.object({
  repos: z.array(z.object({
    id: z.string().describe('Exact repo id from the input'),
    tags: z.array(z.string()).describe('1-3 tags chosen ONLY from the provided tag vocabulary'),
    collectionIds: z.array(z.string()).describe('1-3 collection IDs from the provided list'),
  })),
})

const BATCH_SIZE = 100

export async function categorizeRepos(
  repos: StarredRepo[],
  apiKey: string,
  model = 'google/gemini-2.0-flash-001'
): Promise<CategorizationResult> {
  const openrouter = createOpenRouter({ apiKey })
  const reposToAnalyze = repos.slice(0, 500)
  const repoIdSet = new Set(reposToAnalyze.map(r => r.id))

  const summaries = reposToAnalyze.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    language: r.language || '',
    topics: r.topics.join(', '),
  }))

  // Phase 1: generate collection taxonomy + shared tag vocabulary from all repo summaries
  const { object: taxonomyObj } = await generateObject({
    model: openrouter(model),
    schema: TaxonomySchema,
    experimental_telemetry: { isEnabled: true, functionId: "categorize-taxonomy" },
    system: `You are an expert at organizing GitHub repositories.
Given a list of starred repos, produce:
1. A collection taxonomy of 5-12 thematic groups (e.g. "AI & ML", "Frontend Frameworks", "CLI Tools")
2. A shared tag vocabulary of exactly 15-25 tags that cover the main technologies and themes across ALL repos

Tag rules:
- Tags must be broad enough to apply to multiple repos (e.g. "typescript", "machine-learning", "cli", "database")
- No repo-specific or overly narrow tags — every tag should apply to at least 3 repos
- Use lowercase hyphenated slugs (e.g. "machine-learning", "web-scraping", "dev-tools")
- Target 20 tags total — quality over quantity

Collection name rules: short and scannable, max 22 characters (e.g. "AI & ML", "Frontend", "CLI Tools", "Databases", "DevOps", "Data Science")
Collection ID rules: URL-safe slugs (e.g. "ai-ml", "frontend", "cli-tools")`,
    prompt: `Define a taxonomy for these ${reposToAnalyze.length} starred repos:\n\n${JSON.stringify(summaries)}`,
  })

  const collections: Collection[] = taxonomyObj.collections.map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: COLLECTION_COLORS[i % COLLECTION_COLORS.length],
    repoCount: 0,
  }))
  const collectionIdSet = new Set(collections.map(c => c.id))
  const collectionsList = collections.map(c => `${c.id}: ${c.name}`).join('\n')
  const tagVocabulary = taxonomyObj.tags
  const tagVocabularySet = new Set(tagVocabulary)

  // Phase 2: classify repos in batches of 100
  // (each call: ~100 repos in, ~3-4k tokens out — well within model limits)
  const repoTags: Record<string, Tag[]> = {}
  const repoCollections: Record<string, string[]> = {}
  const allTagsMap = new Map<string, Tag>()

  for (let i = 0; i < reposToAnalyze.length; i += BATCH_SIZE) {
    const batch = summaries.slice(i, i + BATCH_SIZE)

    const { object: batchObj } = await generateObject({
      model: openrouter(model),
      schema: RepoBatchSchema,
      experimental_telemetry: { isEnabled: true, functionId: "categorize-batch" },
      system: `You classify GitHub repos into collections and assign tags from a fixed vocabulary.

Collections (use ONLY these IDs):
${collectionsList}

Tag vocabulary (use ONLY these tags — do NOT invent new ones):
${tagVocabulary.join(', ')}

Rules:
- Assign each repo to 1-3 collections
- Assign 1-3 tags per repo, chosen ONLY from the tag vocabulary above
- Use the EXACT repo IDs from the input — do not modify them`,
      prompt: `Classify these repos:\n\n${JSON.stringify(batch)}`,
    })

    for (const repoResult of batchObj.repos) {
      if (!repoIdSet.has(repoResult.id)) continue

      // Deduplicate labels to avoid duplicate tag keys when rendering
      const uniqueLabels = Array.from(new Set(repoResult.tags.filter(label => tagVocabularySet.has(label))))
      const tags: Tag[] = uniqueLabels.map(label => {
        const tag: Tag = { id: `tag-${label}`, label, color: hashColor(label, TAG_COLORS) }
        allTagsMap.set(label, tag)
        return tag
      })
      repoTags[repoResult.id] = tags

      const validCollections = repoResult.collectionIds.filter(id => collectionIdSet.has(id))
      repoCollections[repoResult.id] = validCollections
    }
  }

  // Compute repoCount per collection
  const collectionRepoCounts: Record<string, number> = {}
  for (const colIds of Object.values(repoCollections)) {
    for (const cid of colIds) {
      collectionRepoCounts[cid] = (collectionRepoCounts[cid] || 0) + 1
    }
  }
  collections.forEach(c => { c.repoCount = collectionRepoCounts[c.id] || 0 })

  return {
    collections,
    allTags: Array.from(allTagsMap.values()),
    repoTags,
    repoCollections,
    generatedAt: new Date().toISOString(),
  }
}
