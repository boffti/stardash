import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

// ponytail: node:sqlite + raw SQL. No ORM, no migration tool. Schema is
// CREATE IF NOT EXISTS; additive changes go in MIGRATIONS below, keyed by
// user_version. Postgres arrays/jsonb are JSON text, booleans are 0/1,
// timestamps are ISO-8601 text.
const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
const UUID = `(lower(hex(randomblob(16))))`

const SCHEMA = `
create table if not exists profiles (
  id text primary key,
  github_username text,
  github_avatar_url text,
  github_id text,
  github_token text,
  github_token_expires_at text,
  github_refresh_token text,
  github_refresh_token_expires_at text,
  created_at text not null default ${NOW},
  updated_at text not null default ${NOW},
  last_github_sync_at text,
  total_starred_count integer not null default 0,
  last_ai_categorization_at text,
  ai_brief_week_start text,
  ai_brief_count integer not null default 0,
  ai_intel_week_start text,
  ai_intel_count integer not null default 0,
  last_contribution_scan_at text,
  last_personalized_search_at text
);

create table if not exists repos (
  id text primary key default ${UUID},
  github_repo_id integer not null unique,
  owner text not null,
  name text not null,
  full_name text not null,
  description text,
  language text,
  language_color text,
  topics text not null default '[]',
  homepage text,
  license text,
  stargazers_count integer not null default 0,
  forks_count integer not null default 0,
  open_issues_count integer not null default 0,
  pushed_at text,
  avatar_url text,
  archived integer not null default 0,
  readme text,
  created_at text not null default ${NOW},
  updated_at text not null default ${NOW}
);
create index if not exists idx_repos_full_name on repos(full_name);

create table if not exists user_starred_repos (
  id text primary key default ${UUID},
  user_id text not null,
  repo_id text not null references repos(id) on delete cascade,
  starred_at text,
  status text,
  is_pinned integer not null default 0,
  notes text,
  created_at text not null default ${NOW},
  updated_at text not null default ${NOW},
  unique (user_id, repo_id)
);
create index if not exists idx_usr_user on user_starred_repos(user_id);

create table if not exists tags (
  id text primary key default ${UUID},
  user_id text not null,
  label text not null,
  color text not null,
  created_at text not null default ${NOW},
  unique (user_id, label)
);

create table if not exists collections (
  id text primary key default ${UUID},
  user_id text not null,
  name text not null,
  emoji text,
  color text,
  created_at text not null default ${NOW}
);

create table if not exists user_starred_repo_tags (
  user_starred_repo_id text not null references user_starred_repos(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  user_id text not null,
  primary key (user_starred_repo_id, tag_id)
);

create table if not exists user_starred_repo_collections (
  user_starred_repo_id text not null references user_starred_repos(id) on delete cascade,
  collection_id text not null references collections(id) on delete cascade,
  user_id text not null,
  primary key (user_starred_repo_id, collection_id)
);

create table if not exists repo_star_snapshots (
  id text primary key default ${UUID},
  repo_github_id integer not null,
  owner text not null,
  name text not null,
  star_count integer not null,
  snapshot_date text not null default (date('now')),
  created_at text not null default ${NOW},
  unique (repo_github_id, snapshot_date)
);

create table if not exists repo_insights (
  id text primary key default ${UUID},
  repo_full_name text not null unique,
  analyzed_at text not null default ${NOW},
  health_score integer check (health_score between 0 and 100),
  maintenance_verdict text,
  community_sentiment text,
  adoption_readiness text,
  top_pain_points text,
  summary text,
  recommendation text,
  metrics text
);

create table if not exists discover_searches (
  id text primary key default ${UUID},
  user_id text not null,
  query text not null,
  normalized_query text not null,
  context_hash text,
  results text not null default '[]',
  pipeline_events text not null default '[]',
  result_count integer not null default 0,
  model_provider text,
  model_id text,
  search_version text not null default 'v1',
  cached_at text not null default ${NOW},
  last_run_at text not null default ${NOW},
  last_opened_at text,
  expires_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days')),
  is_saved integer not null default 0,
  created_at text not null default ${NOW},
  updated_at text not null default ${NOW},
  unique (user_id, normalized_query, search_version)
);

create table if not exists radar_candidates (
  github_repo_id integer primary key,
  owner text not null,
  name text not null,
  full_name text not null,
  description text,
  language text,
  topics text not null default '[]',
  stargazers_count integer not null default 0,
  forks_count integer not null default 0,
  pushed_at text,
  gh_created_at text,
  avatar_url text,
  html_url text not null,
  sources text not null default '{}',
  first_seen_at text not null default ${NOW},
  last_seen_at text not null default ${NOW}
);
create index if not exists idx_radar_candidates_last_seen on radar_candidates(last_seen_at);

create table if not exists radar_signals (
  user_id text not null,
  github_repo_id integer not null,
  actor_login text not null,
  seen_at text not null default ${NOW},
  primary key (user_id, github_repo_id, actor_login)
);

create table if not exists radar_actions (
  user_id text not null,
  github_repo_id integer not null,
  action text not null check (action in ('dismissed','snoozed','starred')),
  until text,
  created_at text not null default ${NOW},
  primary key (user_id, github_repo_id)
);

create table if not exists meta (
  key text primary key,
  value text not null
);

create table if not exists api_tokens (
  id text primary key default ${UUID},
  user_id text not null,
  name text not null,
  token_hash text not null unique,
  created_at text not null default ${NOW},
  last_used_at text
);
`

// Append-only. Each entry runs once, in order, when user_version is below its index + 1.
const MIGRATIONS: string[] = []

function open() {
  const path = process.env.DATABASE_PATH ?? "./data/stardash.db"
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  // busy_timeout first: `next build` evaluates routes in parallel workers that all open this file.
  db.exec("pragma busy_timeout = 5000; pragma journal_mode = wal; pragma foreign_keys = on;")
  db.exec(SCHEMA)
  const version = (db.prepare("pragma user_version").get() as { user_version: number }).user_version
  MIGRATIONS.slice(version).forEach((sql, i) => {
    db.exec(sql)
    db.exec(`pragma user_version = ${version + i + 1}`)
  })
  return db
}

// ponytail: one process, one connection; globalThis survives Next dev HMR.
const g = globalThis as typeof globalThis & { __stardashDb?: DatabaseSync }
export const db = (g.__stardashDb ??= open())

export const nowIso = () => new Date().toISOString()
export const toJson = (value: unknown) => JSON.stringify(value ?? null)
export function fromJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
