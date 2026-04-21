# Security Hardening Plan

This plan captures the work needed before StarDash is open sourced while also running a free hosted deployment for users.

## Deployment Model

StarDash should support two deployment modes:

- **Hosted app**: the official StarDash deployment operated by the project maintainer.
- **Self-hosted app**: a deployment run by another person or organization from the open source repo.

These modes must not share secrets. The hosted app uses the maintainer's Supabase project, GitHub OAuth app, AI provider keys, observability keys, and encryption keys. Self-hosters must create their own credentials and configure them through environment variables.

## GitHub OAuth Token Model

The hosted app needs to call GitHub APIs on behalf of users. Server-side OAuth token storage is standard for this kind of product, but the trust boundary is real: users are trusting the hosted StarDash service with GitHub access granted by the requested OAuth scopes.

Current direction:

- Store GitHub tokens server-side only.
- Use an httpOnly `gh_token` cookie for normal request flow.
- Keep a server-only token store for cookie repair and background refresh.
- Prompt users to reconnect GitHub when repair or refresh is not possible.
- Never expose GitHub tokens to client-side JavaScript.

## Required Hardening Before Public Hosted Launch

### 1. Encrypt Stored GitHub Tokens

The `github_oauth_tokens` table should not store raw tokens in plaintext.

Implement app-level encryption before writing:

- Encrypt `provider_token`.
- Encrypt `provider_refresh_token`.
- Keep the encryption key outside Postgres.
- Use a hosted environment secret, KMS, or secret manager for `GITHUB_TOKEN_ENCRYPTION_KEY`.
- Decrypt only in server-side route handlers or server utilities that need to call GitHub.

The database should remain useful only with the separate encryption key. A database leak alone should not expose usable GitHub tokens.

### 2. Keep Cookie Handling Strict

The GitHub token cookie should remain:

- `httpOnly`
- `secure` outside local development
- `sameSite=lax`
- short-lived
- scoped to `path=/`

Client code should only ask the server whether GitHub access is valid. It should never receive the token.

### 3. Delete Tokens on Disconnect and Account Deletion

Add a user-facing GitHub disconnect or account deletion path that removes:

- the `gh_token` cookie
- the `github_oauth_tokens` row
- any stored provider refresh token

The table already uses `on delete cascade` against `auth.users`, but explicit deletion is still useful for a clear disconnect flow.

### 4. Handle Revoked Tokens

When GitHub returns `401 Bad credentials` or another clear token-revocation signal:

- delete the stored GitHub token row
- clear the `gh_token` cookie
- return a consistent reauth-required error
- prompt the user to reconnect GitHub with a frictionless login flow

Avoid repeatedly retrying known-revoked tokens.

### 5. Minimize GitHub OAuth Scopes

Only request scopes needed for the product.

Document:

- why each scope is needed
- which features break without it
- whether write access is required for starring or unstarring

If StarDash only reads public stars and profile metadata, keep scopes narrow. If private stars, private repos, or star mutations are supported, document the additional access clearly.

### 6. Add Privacy and Security Copy

Before offering the hosted app publicly, add a clear privacy/security page that explains:

- what GitHub data StarDash reads
- whether tokens are stored
- how tokens are protected
- how users can revoke access in GitHub
- how users can delete their StarDash data
- whether AI providers receive repository metadata
- what telemetry is collected by Sentry and Langfuse

This does not need to be legal-heavy at first, but it must be accurate.

## Open Source Readiness Checklist

Before publishing the repo broadly:

- Add or update `.env.example`.
- Document required hosted secrets.
- Document self-hosted setup separately from the official hosted app.
- Explain how to create a GitHub OAuth app.
- Explain how to configure GitHub OAuth in Supabase.
- Explain how to generate and rotate `GITHUB_TOKEN_ENCRYPTION_KEY`.
- Confirm no real secrets are committed.
- Confirm migrations include the GitHub token store.
- Confirm the app degrades gracefully when optional AI or observability keys are missing.
- Add a security contact or vulnerability reporting policy.
- Add a short note explaining that self-hosters must use their own GitHub OAuth credentials.

## Recommended Future Direction

OAuth App token storage is acceptable for the current product shape, especially with encryption and revocation cleanup.

If StarDash grows into a broader GitHub integration, evaluate moving to a GitHub App. GitHub Apps provide more granular permissions, clearer installation boundaries, and short-lived installation tokens, which are usually a better long-term model for production integrations.

## Implementation Order

1. Add token encryption and decryption helpers.
2. Migrate token storage reads/writes to encrypted values.
3. Add token revocation cleanup on GitHub auth failures.
4. Add disconnect/account deletion cleanup.
5. Update `.env.example` and self-hosting docs.
6. Add privacy/security copy for the hosted app.
7. Review OAuth scopes before public launch.
