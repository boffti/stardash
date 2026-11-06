export const PALETTE = [
  { ink: "#3c5d86", wash: "#e8eef5" },
  { ink: "#2f6a50", wash: "#e6f2eb" },
  { ink: "#8a6230", wash: "#f6efe4" },
  { ink: "#8a4e30", wash: "#f6ebe4" },
  { ink: "#8a3e48", wash: "#f6e8ea" },
  { ink: "#7a3e64", wash: "#f4e8ef" },
  { ink: "#5c4680", wash: "#eeeaf4" },
  { ink: "#3d5c64", wash: "#e7eef0" },
] as const

export function paletteIndex(label: string) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0
  return Math.abs(hash) % PALETTE.length
}

export function paletteInk(label: string) {
  return PALETTE[paletteIndex(label)].ink
}

export function healthTone(score: number) {
  if (score >= 70) return PALETTE[1]
  if (score >= 40) return PALETTE[2]
  return PALETTE[4]
}
