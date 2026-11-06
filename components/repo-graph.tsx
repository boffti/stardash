"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, GitFork, RotateCcw } from "lucide-react"
import type { Collection, StarredRepo } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/components/i18n-provider"

type Node = {
  repo: StarredRepo
  x: number
  y: number
  vx: number
  vy: number
}
type Edge = { source: number; target: number; reasons: string[] }

function buildGraph(repos: StarredRepo[], collections: Collection[]) {
  const names = new Map(collections.map((collection) => [collection.id, collection.name]))
  const groups = new Map<string, number[]>()
  repos.forEach((repo, index) => {
    const keys = [
      ...repo.tags.map((tag) => `Tag: ${tag.label}`),
      ...repo.collections.map((id) => `Collection: ${names.get(id) ?? id}`),
      ...repo.topics.map((topic) => `Topic: ${topic}`),
    ]
    for (const key of new Set(keys)) {
      const members = groups.get(key) ?? []
      members.push(index)
      groups.set(key, members)
    }
  })
  const pairs = new Map<string, Edge>()
  for (const [reason, members] of groups) {
    if (members.length > 40) continue
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const key = `${members[i]}:${members[j]}`
        const edge = pairs.get(key) ?? { source: members[i], target: members[j], reasons: [] }
        edge.reasons.push(reason)
        pairs.set(key, edge)
      }
    }
  }
  const degrees = Array(repos.length).fill(0) as number[]
  const edges = [...pairs.values()]
    .sort((a, b) => b.reasons.length - a.reasons.length)
    .filter((edge) => {
      if (degrees[edge.source] >= 5 || degrees[edge.target] >= 5) return false
      degrees[edge.source]++
      degrees[edge.target]++
      return true
    })
  const membership = repos.map(() => "Unconnected")
  const groupSizes = repos.map(() => Infinity)
  for (const [name, members] of groups) {
    if (members.length < 2) continue
    for (const index of members)
      if (members.length < groupSizes[index]) {
        membership[index] = name
        groupSizes[index] = members.length
      }
  }
  const groupNames = [...new Set(membership)]
  const nodes: Node[] = repos.map((repo, index) => {
    const groupIndex = groupNames.indexOf(membership[index])
    const angle = groupIndex * 2.39996
    const radius = 55 + Math.sqrt(groupIndex) * 48
    const offset = index * 2.39996
    return {
      repo,
      x: Math.cos(angle) * radius + Math.cos(offset) * 35,
      y: Math.sin(angle) * radius + Math.sin(offset) * 35,
      vx: 0,
      vy: 0,
    }
  })
  return { nodes, edges }
}

export function RepoGraph({
  repos,
  collections,
  onRepoClick,
}: {
  repos: StarredRepo[]
  collections: Collection[]
  onRepoClick: (repo: StarredRepo) => void
}) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const graph = useMemo(() => buildGraph(repos, collections), [repos, collections])
  const [selected, setSelected] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [reset, setReset] = useState(0)
  const pan = useRef({ x: 0, y: 0 })
  const viewport = useRef({ scale: 1, x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(null)
  }, [graph])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let frame = 0
    let tick = 0
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * devicePixelRatio
      canvas.height = rect.height * devicePixelRatio
    }
    resize()
    const draw = () => {
      const width = canvas.width / devicePixelRatio,
        height = canvas.height / devicePixelRatio
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, width, height)
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity
      for (const node of graph.nodes) {
        minX = Math.min(minX, node.x)
        maxX = Math.max(maxX, node.x)
        minY = Math.min(minY, node.y)
        maxY = Math.max(maxY, node.y)
      }
      const centerX = graph.nodes.length ? (minX + maxX) / 2 : 0
      const centerY = graph.nodes.length ? (minY + maxY) / 2 : 0
      const fit = graph.nodes.length
        ? Math.min(
            1,
            Math.max(1, width - 48) / Math.max(1, maxX - minX),
            Math.max(1, height - 48) / Math.max(1, maxY - minY),
          )
        : 1
      const scale = fit * zoom
      viewport.current = { scale, x: centerX, y: centerY }
      ctx.translate(width / 2 + pan.current.x, height / 2 + pan.current.y)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      const ink = getComputedStyle(canvas).color
      const active = selected
      const neighbors = new Set<number>()
      if (active !== null)
        graph.edges.forEach((edge) => {
          if (edge.source === active) neighbors.add(edge.target)
          if (edge.target === active) neighbors.add(edge.source)
        })
      graph.edges.forEach((edge) => {
        const a = graph.nodes[edge.source],
          b = graph.nodes[edge.target]
        const highlighted = active !== null && (edge.source === active || edge.target === active)
        ctx.strokeStyle = ink
        ctx.globalAlpha = highlighted ? 0.65 : active === null ? 0.25 : 0.025
        ctx.lineWidth = (highlighted ? 1.5 : 1) / scale
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      })
      graph.nodes.forEach((node, i) => {
        const visible = active === null || active === i || neighbors.has(i)
        ctx.globalAlpha = visible ? (active === i ? 1 : 0.6) : 0.1
        ctx.fillStyle = ink
        ctx.beginPath()
        ctx.arc(node.x, node.y, (active === i ? 7 : 4) / Math.min(1, scale), 0, Math.PI * 2)
        ctx.fill()
        if (active === i || (graph.nodes.length < 45 && zoom > 0.8)) {
          ctx.font = "11px system-ui"
          ctx.fillStyle = ink
          ctx.fillText(node.repo.name, node.x + 9, node.y + 4)
        }
      })
      ctx.globalAlpha = 1
      if (tick < (reduced || graph.nodes.length > 300 ? 0 : 240)) {
        const nodes = graph.nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x || 0.1,
              dy = nodes[i].y - nodes[j].y || 0.1
            const d2 = Math.max(100, dx * dx + dy * dy),
              force = 110 / d2
            nodes[i].vx += dx * force
            nodes[i].vy += dy * force
            nodes[j].vx -= dx * force
            nodes[j].vy -= dy * force
          }
        }
        graph.edges.forEach(({ source, target }) => {
          const a = nodes[source],
            b = nodes[target],
            dx = b.x - a.x,
            dy = b.y - a.y
          const distance = Math.max(1, Math.hypot(dx, dy))
          const force = ((distance - 55) / distance) * 0.02
          a.vx += dx * force
          a.vy += dy * force
          b.vx -= dx * force
          b.vy -= dy * force
        })
        nodes.forEach((node) => {
          node.vx = (node.vx - node.x * 0.0008) * 0.85
          node.vy = (node.vy - node.y * 0.0008) * 0.85
          node.x += node.vx
          node.y += node.vy
        })
        tick++
      }
      if (tick < (reduced || graph.nodes.length > 300 ? 0 : 240))
        frame = requestAnimationFrame(draw)
    }
    const redraw = () => {
      cancelAnimationFrame(frame)
      draw()
    }
    const observer = new ResizeObserver(() => {
      resize()
      redraw()
    })
    observer.observe(canvas)
    const themeObserver = new MutationObserver(redraw)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    canvas.addEventListener("graph-redraw", redraw)
    draw()
    return () => {
      cancelAnimationFrame(frame)
      canvas.removeEventListener("graph-redraw", redraw)
      observer.disconnect()
      themeObserver.disconnect()
    }
  }, [graph, zoom, reset, selected])

  const selectedNode = selected === null ? null : graph.nodes[selected]
  const connections =
    selected === null
      ? []
      : graph.edges.filter((edge) => edge.source === selected || edge.target === selected)
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-medium">{t("Graph", "关系图")}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.3, z / 1.25))}
            aria-label={t("Zoom out", "缩小")}
          >
            −
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.min(3, z * 1.25))}
            aria-label={t("Zoom in", "放大")}
          >
            +
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              pan.current = { x: 0, y: 0 }
              setZoom(1)
              setReset((n) => n + 1)
            }}
            aria-label={t("Reset graph view", "重置关系图")}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative flex min-w-0 flex-col lg:flex-row">
        <div className="h-[520px] w-full min-w-0 lg:w-0 lg:flex-1">
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none cursor-grab text-foreground active:cursor-grabbing"
            aria-label={t(
              "Repository graph. Select a repository from the list below to explore its connections.",
              "仓库关系图。从下方列表选择仓库以查看连接。",
            )}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { x: e.clientX, y: e.clientY, moved: false }
            }}
            onPointerMove={(e) => {
              if (!drag.current) return
              const dx = e.clientX - drag.current.x,
                dy = e.clientY - drag.current.y
              if (Math.abs(dx) + Math.abs(dy) > 1) drag.current.moved = true
              pan.current.x += dx
              pan.current.y += dy
              e.currentTarget.dispatchEvent(new Event("graph-redraw"))
              drag.current.x = e.clientX
              drag.current.y = e.clientY
            }}
            onPointerUp={(e) => {
              if (!drag.current?.moved) {
                const rect = e.currentTarget.getBoundingClientRect(),
                  x =
                    (e.clientX - rect.left - rect.width / 2 - pan.current.x) /
                      viewport.current.scale +
                    viewport.current.x,
                  y =
                    (e.clientY - rect.top - rect.height / 2 - pan.current.y) /
                      viewport.current.scale +
                    viewport.current.y
                let best = -1,
                  distance = 15 / viewport.current.scale
                graph.nodes.forEach((node, i) => {
                  const d = Math.hypot(node.x - x, node.y - y)
                  if (d < distance) {
                    best = i
                    distance = d
                  }
                })
                setSelected(best < 0 ? null : best)
              }
              drag.current = null
            }}
          />
        </div>
        <div className="w-full min-w-0 shrink-0 border-t border-border bg-background p-4 lg:w-72 lg:border-t-0 lg:border-l">
          <label htmlFor="graph-repo" className="sr-only">
            {t("Explore a repository", "探索仓库")}
          </label>
          <Select
            value={selected === null ? "none" : String(selected)}
            onValueChange={(value) => setSelected(value === "none" ? null : Number(value))}
          >
            <SelectTrigger id="graph-repo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("Select a repository", "选择仓库")}</SelectItem>
              {graph.nodes.map((node, i) => (
                <SelectItem key={node.repo.id} value={String(i)}>
                  {node.repo.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedNode ? (
            <div className="mt-5 space-y-3">
              <div>
                <p className="break-all text-sm font-semibold">{selectedNode.repo.fullName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedNode.repo.description || t("No description", "无描述")}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onRepoClick(selectedNode.repo)}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                {t("Open details", "查看详情")}
              </Button>
              <div className="pt-3">
                <p className="flex items-center gap-2 text-xs font-medium">
                  <GitFork className="h-3.5 w-3.5" />
                  {connections.length} {t("connections", "个连接")}
                </p>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {connections.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("No displayed connections in this view.", "此视图中没有显示的连接。")}
                    </p>
                  )}
                  {connections.map((edge) => {
                    const index = edge.source === selected ? edge.target : edge.source
                    return (
                      <button
                        key={index}
                        className="block w-full rounded-md p-2 text-left text-xs hover:bg-muted"
                        onClick={() => setSelected(index)}
                      >
                        <span className="block font-medium">
                          {graph.nodes[index].repo.fullName}
                        </span>
                        <span className="text-muted-foreground">
                          {edge.reasons
                            .map((reason) =>
                              reason
                                .replace(/^Tag:/, t("Tag:", "标签："))
                                .replace(/^Collection:/, t("Collection:", "集合："))
                                .replace(/^Topic:/, t("Topic:", "主题：")),
                            )
                            .join(", ")}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
