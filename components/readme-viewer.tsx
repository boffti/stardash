"use client"

import { ExternalLink, Github, FileText, Loader2, AlertCircle } from "lucide-react"
import useSWR from "swr"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StarredRepo } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

interface ReadmeViewerProps {
  repo: StarredRepo | null
  open: boolean
  onClose: () => void
}

interface ReadmeResponse {
  readme: string | null
  error?: string
}

const fetcher = async (url: string): Promise<ReadmeResponse> => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch README')
  }
  return data
}

function resolveImageUrl(src: string | undefined, owner: string, repoName: string): string {
  if (!src) return ""
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src
  const path = src.startsWith("/") ? src.slice(1) : src.startsWith("./") ? src.slice(2) : src
  return `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/${path}`
}

export function ReadmeViewer({ repo, open, onClose }: ReadmeViewerProps) {
  const { data, isLoading } = useSWR<{ readme: string | null }>(
    open && repo ? `/api/github/readme?owner=${repo.owner}&repo=${repo.name}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (!repo) return null

  const readme = data?.readme

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl p-0 border-l border-border flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
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
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
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

        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading README...</p>
              </div>
            ) : readme ? (
              <article className="prose dark:prose-invert prose-sm max-w-none
                prose-headings:font-semibold prose-headings:text-foreground
                prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-3
                prose-h2:text-xl prose-h2:mt-8
                prose-h3:text-lg
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5
                prose-code:rounded prose-code:text-sm prose-code:font-mono
                prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
                prose-pre:overflow-x-auto
                prose-li:text-muted-foreground
                prose-strong:text-foreground
                prose-ul:my-2 prose-li:my-0.5
                prose-table:text-sm prose-thead:border-border prose-tr:border-border
                prose-th:text-foreground prose-td:text-muted-foreground
                prose-blockquote:border-l-accent prose-blockquote:text-muted-foreground
                prose-img:rounded-lg prose-img:max-w-full prose-hr:border-border"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ src, alt }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(src, repo.owner, repo.name)}
                        alt={alt ?? ""}
                        className="max-w-full h-auto rounded-lg"
                        loading="lazy"
                      />
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {readme}
                </ReactMarkdown>
              </article>
            ) : (
              <Empty className="py-16">
                <EmptyMedia variant="icon">
                  <FileText className="h-10 w-10" />
                </EmptyMedia>
                <EmptyTitle>No README available</EmptyTitle>
                <EmptyDescription>
                  This repository doesn&apos;t have a README file.
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
      </SheetContent>
    </Sheet>
  )
}
