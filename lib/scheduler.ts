import { db, nowIso } from "@/lib/db"
import { cronSecret } from "@/lib/cron-auth"

// ponytail: setInterval + a timestamp per job in `meta`. Runs each job at most once per
// 20h, survives restarts without double-running, needs no cron daemon. Replace with a
// real scheduler if jobs ever need exact times or more than one instance.
const JOBS = [
  { name: "star-snapshots", path: "/api/cron/star-snapshots" },
  { name: "radar-ingest", path: "/api/cron/radar-ingest" },
]
const EVERY_MS = 20 * 60 * 60 * 1000
const TICK_MS = 15 * 60 * 1000
const FIRST_TICK_MS = 2 * 60 * 1000

const lastRun = (name: string) =>
  (
    db.prepare("select value from meta where key = ?").get(`cron:${name}`) as
      { value: string } | undefined
  )?.value

const hasToken = () =>
  Boolean(process.env.GITHUB_PAT) ||
  Boolean(db.prepare("select 1 from profiles where github_token is not null limit 1").get())

async function tick() {
  if (!hasToken()) return // nobody signed in yet; nothing to snapshot
  const port = process.env.PORT ?? "3000"
  for (const job of JOBS) {
    const last = lastRun(job.name)
    if (last && Date.now() - new Date(last).getTime() < EVERY_MS) continue
    try {
      const res = await fetch(`http://127.0.0.1:${port}${job.path}`, {
        headers: { authorization: `Bearer ${cronSecret()}` },
      })
      console.info(`[scheduler] ${job.name} -> ${res.status}`)
      if (res.ok) {
        db.prepare("insert or replace into meta (key, value) values (?, ?)").run(
          `cron:${job.name}`,
          nowIso(),
        )
      }
    } catch (error) {
      console.error(`[scheduler] ${job.name} failed`, error)
    }
  }
}

const g = globalThis as typeof globalThis & { __schedulerStarted?: boolean }

/** Call once from instrumentation.register(). No-op in dev unless SCHEDULER=1, and when DISABLE_SCHEDULER is set. */
export function startScheduler() {
  if (g.__schedulerStarted) return
  if (process.env.DISABLE_SCHEDULER) return
  if (process.env.NODE_ENV !== "production" && !process.env.SCHEDULER) return
  g.__schedulerStarted = true
  setTimeout(tick, FIRST_TICK_MS).unref()
  setInterval(tick, TICK_MS).unref()
  console.info("[scheduler] started: star snapshots and radar ingest every 20h")
}
