"use client"

import { ExternalLink, Github, FileText } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StarredRepo } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

interface ReadmeViewerProps {
  repo: StarredRepo | null
  open: boolean
  onClose: () => void
}

export function ReadmeViewer({ repo, open, onClose }: ReadmeViewerProps) {
  if (!repo) return null

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-3xl p-0 border-l border-border"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                  <AvatarFallback className="text-sm">
                    {repo.owner[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="font-mono text-base truncate">
                    {repo.owner}/{repo.name}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    README.md
                  </SheetDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a
                    href={`https://github.com/${repo.fullName}#readme`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="h-3.5 w-3.5" />
                    View on GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
            </div>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {repo.readme ? (
                <article className="prose dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h2:text-xl prose-h2:mt-8 prose-h3:text-lg prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-li:text-muted-foreground prose-strong:text-foreground prose-ul:my-2 prose-li:my-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {repo.readme}
                  </ReactMarkdown>
                </article>
              ) : (
                <Empty className="py-16">
                  <EmptyMedia variant="icon">
                    <FileText className="h-10 w-10" />
                  </EmptyMedia>
                  <EmptyTitle>No README available</EmptyTitle>
                  <EmptyDescription>
                    This repository doesn&apos;t have a README file cached yet.
                  </EmptyDescription>
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5" asChild>
                    <a
                      href={`https://github.com/${repo.fullName}#readme`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="h-3.5 w-3.5" />
                      View on GitHub
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </Empty>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
