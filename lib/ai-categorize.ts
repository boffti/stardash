import { generateObject } from "ai"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type { StarredRepo, Tag, Collection, CategorizationResult } from "./types"
import { PALETTE, paletteInk } from "./palette"

// Phase 1: generate collection taxonomy + shared tag vocabulary
const TaxonomySchema = z.object({
  collections: z.array(
    z.object({
      id: z.string().describe('URL-safe slug e.g. "ai-ml-tools"'),
      name: z
        .string()
        .describe(
          'Human-readable name, max 22 characters e.g. "AI & ML", "Frontend", "CLI Tools", "DevOps"',
        )
        // Clamped to what ensureCollections() stores, so assignment lookups by name keep matching.
        .transform((name) => name.trim().slice(0, 50)),
      emoji: z.string().describe("Single emoji representing the collection"),
    }),
  ),
  tags: z.array(z.string()).describe("Shared vocabulary of 15-25 lowercase hyphenated tags"),
})

// Phase 2: classify a batch of repos using the established taxonomy
const RepoBatchSchema = z.object({
  repos: z.array(
    z.object({
      id: z.string().describe("Exact repo id from the input"),
      tags: z.array(z.string()).describe("1-3 tags chosen ONLY from the provided tag vocabulary"),
      collectionIds: z.array(z.string()).describe("1-3 collection IDs from the provided list"),
    }),
  ),
})

const BATCH_SIZE = 100
// ponytail: local models (Ollama's default 4k context) silently truncate long prompts, so
// they get small batches and a taxonomy drawn from a spread-out sample. Ceiling: the
// taxonomy only sees LOCAL_TAXONOMY_SAMPLE repos; make these configurable if 4k is too tight.
const LOCAL_BATCH_SIZE = 10
const LOCAL_TAXONOMY_SAMPLE = 40

interface CategorizeReposOptions {
  providerOptions?: Record<string, Record<string, string | boolean>>
  /** Small prompts for local models with a short context window. */
  compact?: boolean
  existingTaxonomy?: {
    collections: Collection[]
    tags: Tag[]
  }
}

export async function categorizeRepos(
  repos: StarredRepo[],
  model: LanguageModel,
  options: CategorizeReposOptions = {},
): Promise<CategorizationResult> {
  const reposToAnalyze = repos.slice(0, 500)
  const repoIdSet = new Set(reposToAnalyze.map((r) => r.id))
  const { existingTaxonomy, providerOptions = {}, compact = false } = options
  const batchSize = compact ? LOCAL_BATCH_SIZE : BATCH_SIZE
  const shouldUseExistingTaxonomy = Boolean(
    existingTaxonomy?.collections.length && existingTaxonomy.tags.length,
  )

  const summaries = reposToAnalyze.map((r) => ({
    id: r.id,
    name: r.name,
    description: (r.description || "").slice(0, compact ? 120 : undefined),
    language: r.language || "",
    topics: r.topics.join(", "),
  }))

  let collections: Collection[]
  let tagVocabulary: string[]

  if (shouldUseExistingTaxonomy && existingTaxonomy) {
    collections = existingTaxonomy.collections.map((collection) => ({
      ...collection,
      repoCount: 0,
    }))
    tagVocabulary = existingTaxonomy.tags.map((tag) => tag.label)
  } else {
    // Phase 1: generate collection taxonomy + shared tag vocabulary from all repo summaries
    const step = compact ? Math.max(1, Math.floor(summaries.length / LOCAL_TAXONOMY_SAMPLE)) : 1
    const taxonomyInput = summaries
      .filter((_, i) => i % step === 0)
      .slice(0, compact ? LOCAL_TAXONOMY_SAMPLE : undefined)
    const { object: taxonomyObj } = await generateObject({
      model,
      schema: TaxonomySchema,
      providerOptions,
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
Collection ID rules: URL-safe slugs (e.g. "ai-ml", "frontend", "cli-tools")

Return one json object and no other text. The example shows the shape. Still return 5 to 12 collections and 15 to 25 tags.
{"collections":[{"id":"ai-ml","name":"AI & ML","emoji":"🤖"}],"tags":["typescript","machine-learning","cli"]}`,
      prompt: `Define a taxonomy for these ${taxonomyInput.length} starred repos:\n\n${JSON.stringify(taxonomyInput)}`,
    })

    collections = taxonomyObj.collections.map((c, i) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      color: PALETTE[i % PALETTE.length].ink,
      repoCount: 0,
    }))
    tagVocabulary = taxonomyObj.tags
  }

  const collectionIdSet = new Set(collections.map((c) => c.id))
  const collectionsList = collections.map((c) => `${c.id}: ${c.name}`).join("\n")
  const tagVocabularySet = new Set(tagVocabulary)

  // Phase 2: classify repos in batches of 100
  // (each call: ~100 repos in, ~3-4k tokens out — well within model limits)
  const repoTags: Record<string, Tag[]> = {}
  const repoCollections: Record<string, string[]> = {}
  const allTagsMap = new Map<string, Tag>()
  if (shouldUseExistingTaxonomy && existingTaxonomy) {
    existingTaxonomy.tags.forEach((tag) => allTagsMap.set(tag.label, tag))
  }

  for (let i = 0; i < reposToAnalyze.length; i += batchSize) {
    const batch = summaries.slice(i, i + batchSize)

    const { object: batchObj } = await generateObject({
      model,
      schema: RepoBatchSchema,
      providerOptions,
      experimental_telemetry: { isEnabled: true, functionId: "categorize-batch" },
      system: `You classify GitHub repos into collections and assign tags from a fixed vocabulary.

Collections (use ONLY these IDs):
${collectionsList}

Tag vocabulary (use ONLY these tags — do NOT invent new ones):
${tagVocabulary.join(", ")}

Rules:
- Assign each repo to 1-3 collections
- Assign 1-3 tags per repo, chosen ONLY from the tag vocabulary above
- Use the EXACT repo IDs from the input — do not modify them

Return one json object and no other text.
{"repos":[{"id":"exact-repo-id","tags":["typescript"],"collectionIds":["frontend"]}]}`,
      prompt: `Classify these repos:\n\n${JSON.stringify(batch)}`,
    })

    for (const repoResult of batchObj.repos) {
      if (!repoIdSet.has(repoResult.id)) continue

      // Deduplicate labels to avoid duplicate tag keys when rendering
      const uniqueLabels = Array.from(
        new Set(repoResult.tags.filter((label) => tagVocabularySet.has(label))),
      )
      const tags: Tag[] = uniqueLabels.map((label) => {
        const tag: Tag = { id: `tag-${label}`, label, color: paletteInk(label) }
        allTagsMap.set(label, tag)
        return tag
      })
      repoTags[repoResult.id] = tags

      const validCollections = repoResult.collectionIds.filter((id) => collectionIdSet.has(id))
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
  collections.forEach((c) => {
    c.repoCount = collectionRepoCounts[c.id] || 0
  })

  return {
    collections,
    allTags: Array.from(allTagsMap.values()),
    repoTags,
    repoCollections,
    generatedAt: new Date().toISOString(),
  }
}
