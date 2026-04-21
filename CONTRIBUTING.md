# Contributing to StarDash

Thank you for considering a contribution! This document outlines how to get set up and what to expect.

---

## Getting started

### Prerequisites

- Node.js 20+
- `pnpm`
- A Supabase project with GitHub OAuth configured (see [Self-Hosting docs](./README.md#-self-hosting))

### Local setup

```bash
git clone https://github.com/boffti/stardash.git
cd stardash
pnpm install
cp .env.example .env.local   # fill in your keys
pnpm dev
```

---

## Making changes

1. **Fork** the repo and create a feature branch:

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Write your code.** Keep changes focused and minimal.

3. **Lint** before committing:

   ```bash
   pnpm lint
   ```

4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):

   ```
   feat: add CSV export
   fix: correct tag pagination
   docs: update self-hosting steps
   ```

5. **Push** and open a Pull Request against `main`.

---

## Pull Request guidelines

- Reference the related issue in the PR description (e.g., `Closes #42`).
- Keep PRs small and focused — one logical change per PR.
- Include a short description of *what* changed and *why*.
- Add screenshots for UI changes.

---

## Reporting bugs

Open an [issue](https://github.com/boffti/stardash/issues) and include:

- Steps to reproduce
- Expected vs. actual behaviour
- Browser / OS / Node version if relevant

---

## Feature requests

Open a [discussion](https://github.com/boffti/stardash/discussions) before submitting a feature PR so we can agree on scope and approach.

---

## Code style

- TypeScript — strict mode, no `any` unless absolutely unavoidable.
- Components live in `components/` (shared) or co-located in `app/` (route-specific).
- Prefer server components and server actions; reach for client components only when necessary.
- Tailwind for all styling — no inline styles or CSS modules.

---

## License

By contributing you agree that your contributions will be licensed under the [MIT License](./LICENSE).
