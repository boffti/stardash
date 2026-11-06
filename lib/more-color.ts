import { paletteIndex } from "@/lib/palette"

export const MORE_COLOR_KEY = "stardash-more-color"
const CHANGE_EVENT = "stardash-more-color"

export function chipHue(label: string) {
  return String(paletteIndex(label))
}

export function readMoreColor() {
  if (typeof window === "undefined") return false
  return localStorage.getItem(MORE_COLOR_KEY) === "1"
}

export function applyMoreColor(on: boolean) {
  if (on) document.documentElement.dataset.moreColor = "1"
  else delete document.documentElement.dataset.moreColor
  localStorage.setItem(MORE_COLOR_KEY, on ? "1" : "0")
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeMoreColor(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}
