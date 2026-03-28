"use client"

import { Search, LayoutGrid, List, RefreshCw, User, Github, Settings, Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface DashboardHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: string
  onSortChange: (value: string) => void
  viewMode: "grid" | "list"
  onViewModeChange: (mode: "grid" | "list") => void
  languageFilter: string | null
  onLanguageFilterChange: (language: string | null) => void
  languages: string[]
  lastSynced: string
}

export function DashboardHeader({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  languageFilter,
  onLanguageFilterChange,
  languages,
  lastSynced,
}: DashboardHeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()

  console.log("[v0] Current theme:", theme, "Resolved theme:", resolvedTheme)

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1" />
        
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repos, notes, tags..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <Select
          value={languageFilter ?? "all"}
          onValueChange={(value) => onLanguageFilterChange(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-40 bg-secondary border-0">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            {languages.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-52 bg-secondary border-0">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="starred-desc">Date Starred (Newest)</SelectItem>
            <SelectItem value="starred-asc">Date Starred (Oldest)</SelectItem>
            <SelectItem value="stars-desc">GitHub Stars (High)</SelectItem>
            <SelectItem value="stars-asc">GitHub Stars (Low)</SelectItem>
            <SelectItem value="updated-desc">Last Updated (Recent)</SelectItem>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && onViewModeChange(value as "grid" | "list")}
          className="bg-secondary rounded-md p-0.5"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view" className="h-7 w-7 p-0 data-[state=on]:bg-card data-[state=on]:text-foreground">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className="h-7 w-7 p-0 data-[state=on]:bg-card data-[state=on]:text-foreground">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          <span>Synced {lastSynced}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://avatars.githubusercontent.com/u/1234567" alt="User" />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">developer</p>
              <p className="text-xs text-muted-foreground">@developer</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Github className="mr-2 h-4 w-4" />
              View GitHub
            </DropdownMenuItem>
            <DropdownMenuItem>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Stars
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="ml-6">Theme</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => { console.log("[v0] Setting theme to light"); setTheme("light"); }}>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                    {theme === "light" && <span className="ml-auto text-accent">&#10003;</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { console.log("[v0] Setting theme to dark"); setTheme("dark"); }}>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                    {theme === "dark" && <span className="ml-auto text-accent">&#10003;</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { console.log("[v0] Setting theme to system"); setTheme("system"); }}>
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                    {theme === "system" && <span className="ml-auto text-accent">&#10003;</span>}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
