// Pure helper, safe for client bundles (lib/user-metadata.ts pulls in node:sqlite).
const TAG_PALETTE = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#f97316",
  "#6366f1",
]

export function pickTagColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash << 5) - hash + label.charCodeAt(i)
    hash |= 0
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}
