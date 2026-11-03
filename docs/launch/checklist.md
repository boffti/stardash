# v1.0.0 launch checklist

Run by hand, in order. Nothing here is automated.

## Ship

1. [x] Merge PR 98 (`feat(radar): radar is the front door`). Merged 2026-11-03.
2. [ ] Merge the launch kit PR (`docs: v1.0.0 launch kit`) so the release notes are on `main`.
3. [ ] Tag and push. The Docker workflow builds on `v*` tags and publishes `1.0.0`, `1.0` and `latest`.
   ```bash
   git checkout main && git pull
   git tag v1.0.0 && git push origin v1.0.0
   gh run watch
   ```
4. [ ] Confirm the GHCR image is public. It already pulls anonymously today; recheck after the tag build at https://github.com/boffti/stardash/pkgs/container/stardash, Package settings, Danger Zone, visibility Public. Also tick "Inherit access from source repository".
   ```bash
   docker logout ghcr.io && docker pull ghcr.io/boffti/stardash:1.0.0
   ```
5. [ ] Clean-machine test. On a box with no checkout, run the README one-liner, sign in, see stars, hit Scan now. Time it. Under two minutes or fix before posting.
6. [ ] Create the GitHub release from the notes.
   ```bash
   gh release create v1.0.0 --title "StarDash v1.0.0" --notes-file docs/launch/release-notes-v1.0.0.md
   ```
7. [ ] Repo hygiene before anyone looks. The repo description still says "supabase" and "MCP coming soon". Update description, topics (drop `supabase`, add `mcp`, `self-hosted`, `sqlite`, `docker`) and homepage in Settings. `CONTRIBUTING.md` still describes the Supabase setup; fix it or point it at the README.
8. [ ] Tick Phase 6 in roadmap issue #86 after the posts go out.

## Post

Order matters: HN first, the rest the same morning.

9. [ ] **Show HN**, weekday, 8 to 10am ET. Title, URL and first comment in `show-hn.md`. Post the first comment within a minute of submitting.
10. [ ] **r/selfhosted**, an hour or two later. Flair Release. Title and body in `reddit-selfhosted.md`. Optional cross-post to r/github.
11. [ ] **awesome-mcp-servers PR**, same day. Line, position and commands in `awesome-lists.md`.
12. [ ] **awesome-selfhosted**: not now. Earliest 2027-03-03 (first release must be 4 months old). Calendar reminder. Write the yml yourself; see `awesome-lists.md` for why.
13. [ ] **Product Hunt**, schedule for the following Tuesday, 12:01am PT. Tagline under 60 chars: "New GitHub repos, ranked by the ones you already starred". Gallery: the Radar GIF plus two screenshots (All Stars, MCP settings). First comment: the Show HN comment, trimmed.

## After

14. [ ] Reply to every issue and comment within 24h for two weeks.
15. [ ] Note launch-week numbers in #86: stars, pulls (Package insights), external issues.
