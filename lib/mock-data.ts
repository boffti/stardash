import { Collection, StarredRepo, Tag, LANGUAGE_COLORS } from './types'

export const mockTags: Tag[] = [
  { id: '1', label: 'ai', color: '#8b5cf6' },
  { id: '2', label: 'llm', color: '#06b6d4' },
  { id: '3', label: 'react', color: '#3b82f6' },
  { id: '4', label: 'cli', color: '#10b981' },
  { id: '5', label: 'database', color: '#f59e0b' },
  { id: '6', label: 'devtools', color: '#ec4899' },
  { id: '7', label: 'rust', color: '#dea584' },
  { id: '8', label: 'python', color: '#3572A5' },
]

export const mockCollections: Collection[] = [
  { id: '1', name: 'AI Tools', emoji: '🤖', color: '#8b5cf6', repoCount: 12 },
  { id: '2', name: 'Frontend', emoji: '🎨', color: '#3b82f6', repoCount: 8 },
  { id: '3', name: 'CLI Utilities', emoji: '⚡', color: '#10b981', repoCount: 5 },
  { id: '4', name: 'Database', emoji: '💾', color: '#f59e0b', repoCount: 4 },
  { id: '5', name: 'Learning', emoji: '📚', color: '#ec4899', repoCount: 15 },
]

export const mockRepos: StarredRepo[] = [
  {
    id: '1',
    owner: 'vercel',
    name: 'next.js',
    fullName: 'vercel/next.js',
    description: 'The React Framework for the Web. Used by some of the world\'s largest companies, Next.js enables you to create full-stack web applications.',
    language: 'TypeScript',
    languageColor: LANGUAGE_COLORS['TypeScript'],
    topics: ['react', 'nextjs', 'framework', 'ssr', 'static-site-generator'],
    homepage: 'https://nextjs.org',
    license: 'MIT',
    stargazersCount: 127000,
    forksCount: 27000,
    openIssuesCount: 2400,
    pushedAt: '2026-03-27T10:30:00Z',
    starredAt: '2024-01-15T08:00:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/14985020?v=4',
    status: 'currently-using',
    isPinned: true,
    notes: 'Main framework for all my projects. Keep an eye on App Router updates.',
    tags: [mockTags[2]],
    collections: ['2'],
    readme: `# Next.js

The React Framework for Production.

## Getting Started

\`\`\`bash
npx create-next-app@latest
\`\`\`

## Features

- **Hybrid SSG and SSR**: Pre-render pages at build time (SSG) or request time (SSR) in a single project.
- **Incremental Static Regeneration**: Update static pages after you've built your site, without rebuilding the entire site.
- **TypeScript Support**: Automatic TypeScript configuration and compilation.
- **Fast Refresh**: Fast, reliable live-editing experience.
- **File-system Routing**: Every component in the \`pages\` directory becomes a route.
- **API Routes**: Build your API within Next.js. Serverless functions handle requests.
- **Built-in CSS Support**: Import CSS files, CSS Modules, Sass, and styled-jsx.
- **Code Splitting**: Automatic code splitting for faster page loads.

## Documentation

Visit [https://nextjs.org/docs](https://nextjs.org/docs) to view the full documentation.

## Community

The Next.js community can be found on [GitHub Discussions](https://github.com/vercel/next.js/discussions).

## Contributing

Please see our [contributing.md](/contributing.md).`,
  },
  {
    id: '2',
    owner: 'openai',
    name: 'openai-cookbook',
    fullName: 'openai/openai-cookbook',
    description: 'Examples and guides for using the OpenAI API',
    language: 'Jupyter Notebook',
    languageColor: '#DA5B0B',
    topics: ['openai', 'gpt', 'ai', 'machine-learning', 'examples'],
    homepage: null,
    license: 'MIT',
    stargazersCount: 58000,
    forksCount: 9200,
    openIssuesCount: 85,
    pushedAt: '2026-03-26T15:45:00Z',
    starredAt: '2024-02-20T14:30:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/14957082?v=4',
    status: 'reference',
    isPinned: false,
    notes: null,
    tags: [mockTags[0], mockTags[1]],
    collections: ['1'],
    readme: `# OpenAI Cookbook

The OpenAI Cookbook shares example code for accomplishing common tasks with the OpenAI API.

## Guides & Examples

- **How to format inputs to ChatGPT models**
- **How to stream completions**
- **How to count tokens with tiktoken**
- **Embedding long inputs**
- **How to build an AI that can answer questions about your website**

## Getting Started

Most code examples are written in Python. Install the OpenAI Python library:

\`\`\`bash
pip install openai
\`\`\`

## Contributing

We welcome contributions! Please open an issue or submit a PR.`,
  },
  {
    id: '3',
    owner: 'rust-lang',
    name: 'rust',
    fullName: 'rust-lang/rust',
    description: 'Empowering everyone to build reliable and efficient software.',
    language: 'Rust',
    languageColor: LANGUAGE_COLORS['Rust'],
    topics: ['rust', 'compiler', 'programming-language'],
    homepage: 'https://www.rust-lang.org',
    license: 'Apache-2.0',
    stargazersCount: 98000,
    forksCount: 12600,
    openIssuesCount: 9800,
    pushedAt: '2026-03-28T08:00:00Z',
    starredAt: '2023-06-10T09:15:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/5430905?v=4',
    status: 'want-to-try',
    isPinned: false,
    notes: 'Want to learn Rust for CLI tools and WASM projects.',
    tags: [mockTags[6]],
    collections: ['5'],
    readme: null,
  },
  {
    id: '4',
    owner: 'anthropics',
    name: 'anthropic-cookbook',
    fullName: 'anthropics/anthropic-cookbook',
    description: 'A collection of notebooks/recipes showcasing some fun and effective ways of using Claude.',
    language: 'Jupyter Notebook',
    languageColor: '#DA5B0B',
    topics: ['anthropic', 'claude', 'ai', 'llm'],
    homepage: null,
    license: 'MIT',
    stargazersCount: 8500,
    forksCount: 920,
    openIssuesCount: 12,
    pushedAt: '2026-03-25T12:00:00Z',
    starredAt: '2024-05-01T10:00:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/76263028?v=4',
    status: 'tried-liked',
    isPinned: true,
    notes: 'Great examples for Claude integrations. Used the RAG notebook for my project.',
    tags: [mockTags[0], mockTags[1]],
    collections: ['1'],
    readme: `# Anthropic Cookbook

A collection of notebooks/recipes showcasing some fun and effective ways of using Claude.

## Featured Notebooks

### RAG with Claude
Learn how to implement Retrieval-Augmented Generation with Claude for more accurate, grounded responses.

### Tool Use
Discover how to give Claude access to external tools and APIs.

### Prompt Engineering
Best practices for crafting effective prompts.

## Getting Started

\`\`\`python
from anthropic import Anthropic

client = Anthropic()
message = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}]
)
\`\`\``,
  },
  {
    id: '5',
    owner: 'shadcn-ui',
    name: 'ui',
    fullName: 'shadcn-ui/ui',
    description: 'Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.',
    language: 'TypeScript',
    languageColor: LANGUAGE_COLORS['TypeScript'],
    topics: ['react', 'components', 'ui', 'tailwindcss', 'radix'],
    homepage: 'https://ui.shadcn.com',
    license: 'MIT',
    stargazersCount: 72000,
    forksCount: 4200,
    openIssuesCount: 520,
    pushedAt: '2026-03-27T18:30:00Z',
    starredAt: '2023-11-05T16:45:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/139895814?v=4',
    status: 'currently-using',
    isPinned: true,
    notes: null,
    tags: [mockTags[2], mockTags[5]],
    collections: ['2'],
    readme: `# shadcn/ui

Beautifully designed components that you can copy and paste into your apps.

## Installation

\`\`\`bash
npx shadcn@latest init
\`\`\`

## Usage

\`\`\`bash
npx shadcn@latest add button
\`\`\`

Then import and use:

\`\`\`tsx
import { Button } from "@/components/ui/button"

export default function Home() {
  return <Button>Click me</Button>
}
\`\`\`

## Philosophy

- **Copy and paste** - You own the code. Customize everything.
- **Accessible** - Built with Radix UI primitives.
- **Themeable** - Use CSS variables for theming.`,
  },
  {
    id: '6',
    owner: 'supabase',
    name: 'supabase',
    fullName: 'supabase/supabase',
    description: 'The open source Firebase alternative. Supabase gives you a dedicated Postgres database to build your web, mobile, and AI applications.',
    language: 'TypeScript',
    languageColor: LANGUAGE_COLORS['TypeScript'],
    topics: ['postgres', 'firebase-alternative', 'realtime', 'database', 'auth'],
    homepage: 'https://supabase.com',
    license: 'Apache-2.0',
    stargazersCount: 73000,
    forksCount: 7100,
    openIssuesCount: 340,
    pushedAt: '2026-03-28T06:15:00Z',
    starredAt: '2024-03-12T11:30:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/54469796?v=4',
    status: 'currently-using',
    isPinned: false,
    notes: 'Using for auth and database in multiple projects.',
    tags: [mockTags[4]],
    collections: ['4'],
    readme: null,
  },
  {
    id: '7',
    owner: 'astral-sh',
    name: 'uv',
    fullName: 'astral-sh/uv',
    description: 'An extremely fast Python package and project manager, written in Rust.',
    language: 'Rust',
    languageColor: LANGUAGE_COLORS['Rust'],
    topics: ['python', 'package-manager', 'rust', 'pip', 'uv'],
    homepage: 'https://docs.astral.sh/uv/',
    license: 'Apache-2.0',
    stargazersCount: 35000,
    forksCount: 890,
    openIssuesCount: 450,
    pushedAt: '2026-03-28T02:00:00Z',
    starredAt: '2024-08-15T09:00:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/115962839?v=4',
    status: 'tried-liked',
    isPinned: false,
    notes: 'Replaced pip and poetry with uv. So much faster!',
    tags: [mockTags[6], mockTags[7], mockTags[3]],
    collections: ['3'],
    readme: null,
  },
  {
    id: '8',
    owner: 'BurntSushi',
    name: 'ripgrep',
    fullName: 'BurntSushi/ripgrep',
    description: 'ripgrep recursively searches directories for a regex pattern while respecting your gitignore',
    language: 'Rust',
    languageColor: LANGUAGE_COLORS['Rust'],
    topics: ['rust', 'cli', 'search', 'grep', 'regex'],
    homepage: null,
    license: 'MIT',
    stargazersCount: 48000,
    forksCount: 2000,
    openIssuesCount: 120,
    pushedAt: '2026-02-15T14:00:00Z',
    starredAt: '2022-05-20T08:30:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/456674?v=4',
    status: 'currently-using',
    isPinned: false,
    notes: null,
    tags: [mockTags[3], mockTags[6]],
    collections: ['3'],
    readme: null,
  },
  {
    id: '9',
    owner: 'langchain-ai',
    name: 'langchain',
    fullName: 'langchain-ai/langchain',
    description: 'Build context-aware reasoning applications',
    language: 'Python',
    languageColor: LANGUAGE_COLORS['Python'],
    topics: ['llm', 'ai', 'langchain', 'rag', 'agents'],
    homepage: 'https://python.langchain.com',
    license: 'MIT',
    stargazersCount: 95000,
    forksCount: 15000,
    openIssuesCount: 680,
    pushedAt: '2026-03-28T04:30:00Z',
    starredAt: '2023-12-01T13:00:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/126733545?v=4',
    status: 'tried-dropped',
    isPinned: false,
    notes: 'Tried for RAG project but switched to simpler approach with direct API calls.',
    tags: [mockTags[0], mockTags[1], mockTags[7]],
    collections: ['1'],
    readme: null,
  },
  {
    id: '10',
    owner: 'tailwindlabs',
    name: 'tailwindcss',
    fullName: 'tailwindlabs/tailwindcss',
    description: 'A utility-first CSS framework for rapid UI development.',
    language: 'TypeScript',
    languageColor: LANGUAGE_COLORS['TypeScript'],
    topics: ['css', 'tailwindcss', 'utility-classes', 'framework'],
    homepage: 'https://tailwindcss.com',
    license: 'MIT',
    stargazersCount: 83000,
    forksCount: 4200,
    openIssuesCount: 45,
    pushedAt: '2026-03-27T20:00:00Z',
    starredAt: '2021-08-10T10:00:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/67109815?v=4',
    status: 'currently-using',
    isPinned: true,
    notes: null,
    tags: [mockTags[2], mockTags[5]],
    collections: ['2'],
    readme: null,
  },
  {
    id: '11',
    owner: 'ollama',
    name: 'ollama',
    fullName: 'ollama/ollama',
    description: 'Get up and running with Llama 3.3, Mistral, Gemma 2, and other large language models.',
    language: 'Go',
    languageColor: LANGUAGE_COLORS['Go'],
    topics: ['llm', 'ai', 'local', 'ollama', 'llama'],
    homepage: 'https://ollama.com',
    license: 'MIT',
    stargazersCount: 105000,
    forksCount: 8200,
    openIssuesCount: 1200,
    pushedAt: '2026-03-28T01:00:00Z',
    starredAt: '2024-01-05T15:30:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/151674099?v=4',
    status: 'currently-using',
    isPinned: false,
    notes: 'Running local models for development and testing.',
    tags: [mockTags[0], mockTags[1]],
    collections: ['1'],
    readme: null,
  },
  {
    id: '12',
    owner: 'drizzle-team',
    name: 'drizzle-orm',
    fullName: 'drizzle-team/drizzle-orm',
    description: 'Headless TypeScript ORM with a head. Runs on Node, Bun and Deno. Lives on the Edge and yes, it\'s a JavaScript ORM too',
    language: 'TypeScript',
    languageColor: LANGUAGE_COLORS['TypeScript'],
    topics: ['orm', 'typescript', 'database', 'postgres', 'mysql', 'sqlite'],
    homepage: 'https://orm.drizzle.team',
    license: 'Apache-2.0',
    stargazersCount: 25000,
    forksCount: 620,
    openIssuesCount: 380,
    pushedAt: '2026-03-27T22:00:00Z',
    starredAt: '2024-06-20T09:45:00Z',
    avatarUrl: 'https://avatars.githubusercontent.com/u/108468352?v=4',
    status: 'want-to-try',
    isPinned: false,
    notes: 'Want to try as Prisma alternative for better edge compatibility.',
    tags: [mockTags[4], mockTags[5]],
    collections: ['4'],
    readme: null,
  },
]
