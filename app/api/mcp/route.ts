import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { z } from "zod"
import { verifyApiToken } from "@/lib/api-tokens"
import {
  getRepo,
  listTaxonomy,
  organizeRepo,
  radarAction,
  radarFeed,
  searchStars,
  starOnGitHub,
} from "@/lib/mcp-tools"

export const maxDuration = 60

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
})
const uid = (extra: { authInfo?: { extra?: Record<string, unknown> } }) =>
  String(extra.authInfo?.extra?.userId ?? "")

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "search_stars",
      "Search the user's starred GitHub repos by text, tag, collection, language or status.",
      {
        query: z.string().optional().describe("Matches name, description, topics and notes"),
        tag: z.string().optional(),
        collection: z.string().optional(),
        language: z.string().optional(),
        status: z
          .string()
          .optional()
          .describe(
            "want-to-try, currently-using, tried-liked, tried-dropped, just-interesting, reference",
          ),
        limit: z.number().int().min(1).max(100).optional(),
      },
      async (args, extra) => text(searchStars(uid(extra), args)),
    )
    server.tool(
      "get_repo",
      "One starred repo with the user's status, notes, tags, collections and a README excerpt.",
      { fullName: z.string().describe("owner/name") },
      async ({ fullName }, extra) =>
        text(getRepo(uid(extra), fullName) ?? { error: "not in your stars" }),
    )
    server.tool(
      "list_taxonomy",
      "The user's tags and collections with repo counts. Read this before organizing.",
      {},
      async (_args, extra) => text(listTaxonomy(uid(extra))),
    )
    server.tool(
      "organize_repo",
      "Set status, notes, tags and collections on a starred repo. Missing tags and collections are created.",
      {
        fullName: z.string(),
        status: z.string().nullable().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        collections: z.array(z.string()).optional(),
      },
      async (args, extra) => text(organizeRepo(uid(extra), args)),
    )
    server.tool(
      "radar_feed",
      "New and rising repos ranked against the user's taste, each with the reasons it surfaced.",
      { limit: z.number().int().min(1).max(80).optional() },
      async ({ limit }, extra) => text(radarFeed(uid(extra), limit)),
    )
    server.tool(
      "radar_action",
      "Dismiss or snooze (7 days) a Radar item, or undo.",
      { githubRepoId: z.number().int(), action: z.enum(["dismissed", "snoozed", "undo"]) },
      async ({ githubRepoId, action }, extra) =>
        text(radarAction(uid(extra), githubRepoId, action)),
    )
    server.tool(
      "star_repo",
      "Star a repository on GitHub as the user.",
      { owner: z.string(), repo: z.string() },
      async ({ owner, repo }, extra) => text(await starOnGitHub(uid(extra), owner, repo)),
    )
  },
  { serverInfo: { name: "stardash", version: "1.0.0" } },
  { basePath: "/api", disableSse: true, maxDuration: 60 },
)

const authed = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    const userId = verifyApiToken(bearerToken)
    if (!userId) return undefined
    return { token: bearerToken!, clientId: "stardash", scopes: ["stars"], extra: { userId } }
  },
  { required: true },
)

export { authed as GET, authed as POST, authed as DELETE }
