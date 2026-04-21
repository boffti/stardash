"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Search, X, ArrowRight, Loader2 } from "lucide-react"
import { Particles } from "@/components/ui/particles"
import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const EXAMPLE_QUERIES = [
  "AI context management tools",
  "prod-ready CLI frameworks",
  "Rust async runtimes",
  "minimal auth libraries",
  "TypeScript build tools",
]

interface SearchHeroProps {
  onSearch: (query: string) => void
  isLoading: boolean
  hasResults: boolean
  onClear: () => void
}

export function SearchHero({ onSearch, isLoading, hasResults, onClear }: SearchHeroProps) {
  const [query, setQuery] = useState("")
  const chips = EXAMPLE_QUERIES.slice(0, 4)

  const handleSubmit = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed || isLoading) return
    onSearch(trimmed)
  }, [onSearch, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit(query)
    if (e.key === "Escape" && hasResults) {
      setQuery("")
      onClear()
    }
  }

  const handleChip = (chip: string) => {
    setQuery(chip)
    handleSubmit(chip)
  }

  if (hasResults) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-3"
      >
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search again..."
              autoFocus
              className="w-full h-9 pl-9 pr-4 bg-muted/40 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent"
            />
          </div>
          <Button
            size="sm"
            onClick={() => handleSubmit(query)}
            disabled={isLoading || !query.trim()}
            className="shrink-0"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setQuery(""); onClear() }}
            className="shrink-0 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="relative flex flex-col items-center justify-center py-20 px-6 overflow-hidden">
      <Particles
        className="absolute inset-0 pointer-events-none"
        quantity={60}
        staticity={50}
        color="#22c55e"
        size={0.4}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-6"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">What are you building?</h2>
          <p className="text-sm text-muted-foreground">
            Describe your intent — AI finds the best repos for you
          </p>
        </div>

        <div className="relative w-full rounded-xl border border-border/60 bg-card overflow-hidden shadow-lg shadow-black/10">
          <BorderBeam
            size={120}
            duration={8}
            colorFrom="#22c55e"
            colorTo="#16a34a"
            borderWidth={1.5}
          />
          <div className="relative flex items-center gap-2 p-3">
            <Search className="shrink-0 ml-1 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. prod-ready CLI frameworks, AI context tools..."
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Button
              size="sm"
              onClick={() => handleSubmit(query)}
              disabled={isLoading || !query.trim()}
              className="shrink-0 h-8"
            >
              {isLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><span className="mr-1.5 text-xs">Search</span><ArrowRight className="h-3 w-3" /></>
              }
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {chips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-wrap justify-center gap-2"
            >
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChip(chip)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs border border-border/50 bg-muted/30",
                    "text-muted-foreground hover:text-accent-foreground hover:border-accent/50 hover:bg-accent/10",
                    "transition-all duration-150"
                  )}
                >
                  {chip}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
