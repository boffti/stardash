"use client"

import React from "react"
import { ExternalLink, Github, Loader2, AlertCircle, MessageSquare, Calendar } from "lucide-react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import type { ContributionOpportunity } from "@/lib/contribution-opportunities"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

interface IssueViewerProps {
  opportunity: ContributionOpportunity | null
  open: boolean
  onClose: () => void
}

interface IssueResponse {
  body: string | null
  author: string | null
  authorAvatar: string | null
  createdAt: string
  comments: number
  error?: string
  code?: string
}

const fetcher = async (url: string): Promise<IssueResponse> => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to fetch issue")
  return data
}

function getCodeBlockProps(children: React.ReactNode) {
  if (!React.isValidElement(children)) return null
  const childProps = children.props as { className?: string; children?: React.ReactNode }
  const match = /language-([\w-]+)/.exec(childProps.className || "")
  if (!match) return null
  return {
    code: String(childProps.children ?? "").replace(/\n$/, ""),
    language: match[1],
  }
}

export function IssueViewer({ opportunity, open, onClose }: IssueViewerProps) {
  const [owner, repo] = (opportunity?.repoFullName ?? "").split("/")

  const { data, error, isLoading } = useSWR<IssueResponse>(
    open && opportunity ? `/api/github/issue?owner=${owner}&repo=${repo}&number=${opportunity.issueNumber}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  if (!opportunity) return null

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-border p-0 sm:max-w-lg lg:max-w-2xl xl:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-border py-3 pl-4 pr-16 sm:py-4 sm:pl-6 sm:pr-20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{opportunity.repoFullName}</span>
                <span>#{opportunity.issueNumber}</span>
              </div>
              <SheetTitle className="text-left text-sm font-semibold leading-snug sm:text-base">
                {opportunity.title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Full issue body for {opportunity.repoFullName} #{opportunity.issueNumber}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2 sm:px-3" asChild>
              <a href={opportunity.htmlUrl} target="_blank" rel="noopener noreferrer">
                <Github className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open on GitHub</span>
                <ExternalLink className="hidden h-3 w-3 sm:block" />
              </a>
            </Button>
          </div>

          {/* Meta row */}
          {data && !isLoading && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {data.author && (
                <span className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={data.authorAvatar ?? undefined} alt={data.author} />
                    <AvatarFallback className="text-[8px]">{data.author[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {data.author}
                </span>
              )}
              {data.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
                </span>
              )}
              {data.comments > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {data.comments} comments
                </span>
              )}
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs">{opportunity.difficulty}</Badge>
                {opportunity.labels.slice(0, 4).map((label) => (
                  <Badge key={label} variant="outline" className="max-w-40 truncate text-xs">{label}</Badge>
                ))}
              </div>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading issue...</p>
              </div>
            ) : error ? (
              <Empty className="py-16">
                <EmptyMedia variant="icon">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </EmptyMedia>
                <EmptyTitle>Failed to load issue</EmptyTitle>
                <EmptyDescription>Could not fetch issue body from GitHub.</EmptyDescription>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" asChild>
                  <a href={opportunity.htmlUrl} target="_blank" rel="noopener noreferrer">
                    <Github className="h-3.5 w-3.5" />
                    View on GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </Empty>
            ) : data?.body ? (
              <article className="prose dark:prose-invert prose-sm max-w-full
                prose-headings:font-semibold prose-headings:text-foreground
                prose-h1:text-xl prose-h1:border-b prose-h1:border-border prose-h1:pb-3
                prose-h2:text-lg prose-h2:mt-6
                prose-h3:text-base
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5
                prose-code:rounded prose-code:text-sm prose-code:font-mono
                prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
                prose-li:text-muted-foreground
                prose-strong:text-foreground
                prose-ul:my-2 prose-li:my-0.5
                prose-table:text-sm prose-thead:border-border prose-tr:border-border
                prose-th:text-foreground prose-td:text-muted-foreground
                prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
                prose-img:rounded-lg prose-img:max-w-full prose-hr:border-border
                [&>*]:max-w-full [&>table]:block [&>table]:overflow-x-auto"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => {
                      const block = getCodeBlockProps(children)
                      if (!block) return <pre>{children}</pre>
                      return (
                        <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border">
                          <SyntaxHighlighter
                            language={block.language}
                            style={oneDark}
                            wrapLongLines
                            customStyle={{
                              margin: 0,
                              padding: "1rem",
                              borderRadius: 0,
                              fontSize: "0.875rem",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                            codeTagProps={{ style: { fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-word" } }}
                          >
                            {block.code}
                          </SyntaxHighlighter>
                        </div>
                      )
                    },
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                    ),
                    code(props) {
                      const { children, className, ...rest } = props
                      return <code {...rest} className={className}>{children}</code>
                    },
                  }}
                >
                  {data.body}
                </ReactMarkdown>
              </article>
            ) : (
              <Empty className="py-16">
                <EmptyMedia variant="icon">
                  <Github className="h-10 w-10 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>No description</EmptyTitle>
                <EmptyDescription>This issue has no body text.</EmptyDescription>
              </Empty>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
