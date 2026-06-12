/**
 * Conventional Commits config.
 * Allowed types match the project's existing history (feat, fix, chore, refactor, docs, ...).
 * See https://www.conventionalcommits.org
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow a slightly longer header than the 72-char default.
    "header-max-length": [2, "always", 100],
  },
}

export default config
