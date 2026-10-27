/** Post-login destination: same-origin absolute path only. Rejects `//host`, backslashes, whitespace and control chars. */
export const safeNext = (value: string | null | undefined, fallback = "/dashboard") =>
  value && /^\/(?![/\\])[^\s\\]*$/.test(value) ? value : fallback
