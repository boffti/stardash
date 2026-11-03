# Show HN

## Title (74 chars)

```
Show HN: StarDash, new GitHub repos ranked by the ones you already starred
```

Alternates, all under 80:

```
Show HN: StarDash, a self-hosted radar for new GitHub repos (one container)
Show HN: I star repos and forget them, so I built a radar for new ones
```

## URL

```
https://github.com/boffti/stardash
```

## First comment (post immediately after submitting)

I star a lot of repos and then forget them. The list is a graveyard: things I meant to try, things I use daily, things I dropped, all in one flat pile. And the pile only grows, because I never go back to it. Meanwhile the interesting new stuff shows up on HN or in a friend's stars and slips past.

StarDash is my fix for both halves.

Radar is the front door. Nightly it pulls new and rising repos from GitHub search, Hacker News, and the stars of people you follow. Then it ranks them against your own stars: topics and languages weighted by what you marked as currently-using versus tried-and-dropped. Every row says why it surfaced ("3 people you follow starred this", "+2.1k stars this week", "matches local-first, sqlite"). You star, snooze, or dismiss with j/k/x/z. The whole scoring function is about 150 lines in lib/radar.ts; social signal outranks a topic match, which turned out to be the single most useful rule.

The rest is the organizer: every star searchable, a status per repo, notes, collections and tags (hand-made or one AI pass over 500 repos for about a cent).

It is one container. `docker run -p 3000:3000 -v stardash-data:/data ghcr.io/boffti/stardash:latest`, then click Connect GitHub. The instance creates its own GitHub App through the manifest flow, so there is no OAuth app to register and no secrets to paste. SQLite on a volume, nightly jobs in-process, no external services. The earlier version needed Supabase, Vercel cron and a hand-made OAuth app before you saw a single star, and nobody ran it. This one takes under two minutes, timed.

There is also an MCP server at /api/mcp. Claude Code or Cursor can search your stars, read today's Radar, and star or dismiss from inside a coding session. Tokens are minted in Settings or from a shell with `docker exec stardash node bin/stardash.mjs token claude-code`.

Next.js 16, SQLite via node:sqlite, MIT. AI features are optional and bring-your-own-key.

What I would like to know: does the ranking match your taste, and which signal is missing?

## Notes

- Submit on a weekday between 8 and 10am ET.
- Do not ask anyone to upvote. Reply to every comment within the first few hours.
- The GIF at the top of the README is the demo. No separate landing page needed.
