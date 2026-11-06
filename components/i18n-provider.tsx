"use client"

import * as React from "react"

export type Language = "system" | "en" | "zh-CN"
export type Locale = Exclude<Language, "system">

type I18nContextValue = {
  language: Language
  locale: Locale
  setLanguage: (language: Language) => void
  t: (english: string, chinese: string) => string
}

const I18nContext = React.createContext<I18nContextValue | null>(null)
const STORAGE_KEY = "stardash-language"

function browserLocale(): Locale {
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en"
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("system")
  const [systemLocale, setSystemLocale] = React.useState<Locale>("en")

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "system" || stored === "en" || stored === "zh-CN") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(stored)
    }
    const update = () => setSystemLocale(browserLocale())
    update()
    window.addEventListener("languagechange", update)
    return () => window.removeEventListener("languagechange", update)
  }, [])

  const locale = language === "system" ? systemLocale : language
  React.useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLanguage = React.useCallback((next: Language) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    setLanguageState(next)
  }, [])
  const t = React.useCallback(
    (english: string, chinese: string) => (locale === "zh-CN" ? chinese : english),
    [locale],
  )
  const value = React.useMemo(
    () => ({ language, locale, setLanguage, t }),
    [language, locale, setLanguage, t],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = React.useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used within an I18nProvider")
  return context
}
