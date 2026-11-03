# Awesome list PRs

Two lists, two very different rule sets. Read both notes before opening anything.

## awesome-mcp-servers (punkpeye/awesome-mcp-servers)

Open this one the week of launch.

**Target file:** `README.md`, section `### 🔄 Version Control`. Entries are alphabetical by `owner/repo`, case-insensitive. Insert after `adhikasp/mcp-git-ingest` and before `costajohnt/oss-autopilot`.

**Exact line:**

```markdown
- [boffti/stardash](https://github.com/boffti/stardash) 📇 🏠 - Self-hosted dashboard for your GitHub stars. Search and organize starred repos, read the Radar feed of new repos ranked by your taste, star or dismiss from an agent.
```

Legend used: 📇 TypeScript codebase, 🏠 local service (the MCP endpoint is the app you run yourself).

**Commands:**

```bash
gh repo fork punkpeye/awesome-mcp-servers --clone --default-branch-only
cd awesome-mcp-servers
git checkout -b add-stardash
# edit README.md: paste the line above into the Version Control section, alphabetical position
git commit -am "Add StarDash server"
git push -u origin add-stardash
gh pr create --repo punkpeye/awesome-mcp-servers --title "Add StarDash server" --body "Adds StarDash (https://github.com/boffti/stardash) to Version Control. Self-hosted dashboard for GitHub stars with an MCP server at /api/mcp: search_stars, get_repo, list_taxonomy, organize_repo, radar_feed, radar_action, star_repo."
```

Note: their CONTRIBUTING fast-tracks PRs whose title ends in `🤖🤖🤖`, but that opt-in is for PRs submitted by an agent. You are submitting this yourself, so leave it off.

## awesome-selfhosted (awesome-selfhosted/awesome-selfhosted-data)

**Do not open this one at launch.** Two blockers:

1. **Age rule.** "Any software project you are adding was first released more than 4 months ago." The count starts at the first tagged release. If `v1.0.0` is tagged on 2026-11-03, the earliest submission date is **2027-03-03**. Put it in the calendar. Submissions before that are closed with a canned reply.
2. **No machine-written entries.** Their CONTRIBUTING says machine or LLM-generated contributions result in a ban, and it specifically tells agents not to write the entry text, the PR body, or tick the "submission was done by a human" box. So this file does not draft the entry. It gives you the schema and the facts you need to write it yourself in one minute.

The markdown repo `awesome-selfhosted/awesome-selfhosted` is generated. The PR goes to the **data** repo.

**Target file:** `software/stardash.yml` (new file, kebab-case).

**Schema** (mandatory fields, from their `addition.md` template; remove comments and unused optional fields before committing):

```yaml
name:
website_url:
source_code_url:
description:        # under 250 characters, sentence case, no "self-hosted" or "open-source" (implied), no leading "A"
licenses:
  -
platforms:
  -
tags:
  -
```

**Facts to fill it from** (verified against their `licenses.yml`, `platforms/` and `tags/` on 2026-11-03):

- Source: `https://github.com/boffti/stardash`. Website: same, or `https://stardash.dev` if that stays up.
- License identifier: `MIT`.
- Platform names that exist: `Docker`, `Nodejs`. Use the ones a user needs to run it.
- Tag names that exist and could fit: `Bookmarks and Link Sharing`, `Software Development - IDE & Tools`, `Personal Dashboards`. The single-page list shows the software only under the first tag, so put the best one first.
- Optional: `demo_url` only for an interactive demo, never a video. `icon_url` prefers dashboardicons.com.

**Commands** (run after 2027-03-03, after you wrote the yml yourself):

```bash
gh repo fork awesome-selfhosted/awesome-selfhosted-data --clone --default-branch-only
cd awesome-selfhosted-data
git checkout -b add-stardash
# create software/stardash.yml by hand
git add software/stardash.yml
git commit -m "add StarDash"
git push -u origin add-stardash
gh pr create --repo awesome-selfhosted/awesome-selfhosted-data --title "Add StarDash" --web
```

`--web` opens the PR in the browser so you fill their checklist template yourself. Expect merge about a week after approval.
