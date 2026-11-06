"use client"

import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from "next-themes"

type Theme = "light" | "dark" | "system"

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  enableSystem?: boolean
  attribute?: "class"
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemeProvider {...props}>{children}</NextThemeProvider>
}

export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useNextTheme()

  return {
    theme: theme === "light" || theme === "dark" ? theme : "system",
    resolvedTheme: resolvedTheme === "light" ? "light" : "dark",
    setTheme: (nextTheme: Theme) => setTheme(nextTheme),
  }
}
