"use client"

import React from "react"
import { ExternalLink, Github, FileText, Loader2, AlertCircle } from "lucide-react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
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
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

interface ReadmeViewerProps {
  repo: StarredRepo | null
  open: boolean
  onClose: () => void
}

interface ReadmeResponse {
  readme: string | null
  error?: string
  code?: string
}

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

const fetcher = async (url: string): Promise<ReadmeResponse> => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    if (res.status === 401 || data.code === 'GITHUB_AUTH_ERROR') {
      throw new AuthError(data.error || 'GitHub authentication expired')
    }
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

function getCodeBlockProps(children: React.ReactNode) {
  if (!React.isValidElement(children)) return null

  const childProps = children.props as { className?: string; children?: React.ReactNode }
  const match = /language-([\w-]+)/.exec(childProps.className || "")

  if (!match) return null

  return {
    className: childProps.className,
    code: String(childProps.children ?? "").replace(/\n$/, ""),
    language: match[1],
  }
}

export function ReadmeViewer({ repo, open, onClose }: ReadmeViewerProps) {
  const { data, error, isLoading } = useSWR<ReadmeResponse>(
    open && repo ? `/api/github/readme?owner=${repo.owner}&repo=${repo.name}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (!repo) return null

  const readme = data?.readme
  const isAuthError = error instanceof AuthError

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg lg:max-w-2xl xl:max-w-3xl p-0 border-l border-border flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <SheetHeader className="border-b border-border shrink-0 space-y-0 py-3 pl-4 pr-16 sm:py-4 sm:pl-6 sm:pr-20">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                <AvatarImage src={repo.avatarUrl} alt={repo.owner} />
                <AvatarFallback className="text-xs sm:text-sm">
                  {repo.owner[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 overflow-hidden">
                <SheetTitle className="font-mono text-sm sm:text-base truncate text-left">
                  {repo.owner}/{repo.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground text-left hidden sm:block">
                  README.md
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2 sm:px-3" asChild>
                <a
                  href={`https://github.com/${repo.fullName}#readme`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">View on GitHub</span>
                  <span className="sm:hidden">GitHub</span>
                  <ExternalLink className="h-3 w-3 hidden sm:block" />
                </a>
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 min-w-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading README...</p>
              </div>
            ) : isAuthError ? (
              <Empty className="py-16">
                <EmptyMedia variant="icon">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </EmptyMedia>
                <EmptyTitle>Session Expired</EmptyTitle>
                <EmptyDescription>
                  Your GitHub session has expired. Please sign in again to view READMEs.
                </EmptyDescription>
                <Button
                  variant="default"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={async () => {
                    const supabase = createClient()
                    const currentPath = window.location.pathname + window.location.search
                    await supabase.auth.signInWithOAuth({
                      provider: 'github',
                      options: {
                        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`,
                        scopes: 'read:user user:email',
                      },
                    })
                  }}
                >
                  <Github className="h-3.5 w-3.5" />
                  Reconnect GitHub
                </Button>
              </Empty>
            ) : readme ? (
              <article className="prose dark:prose-invert prose-sm max-w-full
                prose-headings:font-semibold prose-headings:text-foreground
                prose-h1:text-xl sm:prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-3
                prose-h2:text-lg sm:prose-h2:text-xl prose-h2:mt-6 sm:prose-h2:mt-8
                prose-h3:text-base sm:prose-h3:text-lg
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5
                prose-code:rounded prose-code:text-sm prose-code:font-mono
                prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
                prose-pre:overflow-x-auto prose-pre:max-w-full
                prose-li:text-muted-foreground
                prose-strong:text-foreground
                prose-ul:my-2 prose-li:my-0.5
                prose-table:text-sm prose-thead:border-border prose-tr:border-border
                prose-th:text-foreground prose-td:text-muted-foreground
                prose-table:max-w-full prose-table:overflow-x-auto
                prose-blockquote:border-l-accent prose-blockquote:text-muted-foreground
                prose-img:rounded-lg prose-img:max-w-full prose-hr:border-border
                [&>*]:max-w-full [&>div]:max-w-full [&>table]:block [&>table]:overflow-x-auto
                [&>pre]:max-w-full [&>pre>code]:whitespace-pre-wrap [&>pre>code]:break-words"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => {
                      const codeBlock = getCodeBlockProps(children)

                      if (!codeBlock) {
                        return <pre>{children}</pre>
                      }

                      return (
                        <div className="not-prose my-4 max-w-full overflow-x-auto rounded-lg border border-border">
                          <SyntaxHighlighter
                            language={codeBlock.language}
                            style={oneDark}
                            wrapLongLines
                            customStyle={{
                              margin: 0,
                              padding: "1rem",
                              borderRadius: 0,
                              fontSize: "0.875rem",
                              minWidth: "100%",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                            codeTagProps={{
                              style: {
                                fontFamily: "var(--font-mono)",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              },
                            }}
                          >
                            {codeBlock.code}
                          </SyntaxHighlighter>
                        </div>
                      )
                    },
                    img: ({ src, alt }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(src as string | undefined, repo.owner, repo.name)}
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
                    code(props) {
                      const { children, className, ...rest } = props

                      return (
                        <code {...rest} className={className}>
                          {children}
                        </code>
                      )
                    },
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
