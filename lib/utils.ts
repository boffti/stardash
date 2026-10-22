import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "Thu 5:03 PM" style timestamp for cooldown and next-run messages. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "later"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "later"
  return d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })
}
