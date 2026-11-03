# r/selfhosted

Flair: **Release**. Post as text (self post), link inside.

## Title

```
StarDash v1.0: a radar for new GitHub repos, ranked by the ones you already starred. One container, SQLite, MCP server.
```

## Body

I star repos and forget them. StarDash remembers, and tells you which new ones your taste says to look at.

**Radar** is the main view. Nightly it pulls new and rising repos from GitHub search, Hacker News and the stars of people you follow, then ranks them against your own stars. Each row says why it surfaced: "3 people you follow starred this", "+2.1k stars this week", "matches local-first, sqlite". Star, snooze, dismiss, keyboard-driven.

Behind that is the organizer: every starred repo searchable, a status per repo (want to try, currently using, dropped, reference), notes, pins, collections and tags.

**Self-hosting:**

```
docker run -d --name stardash -p 3000:3000 -v stardash-data:/data ghcr.io/boffti/stardash:latest
```

Open http://localhost:3000, click Connect GitHub, click Create GitHub App, authorize. The instance creates its own GitHub App, so there is no OAuth app to register and no client secret to copy. Everything is in one SQLite file on the volume. Nightly jobs run in-process. No external services, no accounts beyond GitHub. There is a docker-compose file in the repo too, and a paste-a-token login for GitHub Enterprise or boxes without a browser.

Plain HTTP on a LAN works. Put it behind your reverse proxy with HTTPS for anything public; set `APP_URL` if the proxy does not forward host and proto headers.

**MCP server** at `/api/mcp`, so Claude Code, Cursor or any MCP client can search your stars and triage your Radar feed. Tokens are minted in Settings.

**AI features are optional.** Auto-categorize (about a cent for 500 repos on the default OpenRouter model), repo health reports, contribution briefs. Bring your own OpenRouter, OpenAI or Anthropic key. Everything else works without one.

Stack: Next.js 16, SQLite via node:sqlite, Node 24 image, amd64 and arm64. MIT.

Repo: https://github.com/boffti/stardash

Happy to answer questions. Issues labelled good first issue are open if you want to poke at it.

## Notes

- r/selfhosted rules: disclose you are the author (done in the first line), no affiliate links, flair as Release.
- Post the same morning as Show HN, an hour or two later.
- Optional second post to r/github with the same body, flair Project.
