"use client"

import { useState, useEffect, useMemo } from "react"
import { Archive, TrendingUp, ChevronDown, ChevronUp, X, Bell, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StarredRepo } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ProactiveAlertsProps {
  repos: StarredRepo[]
  userId: string | undefined
}

type AlertType = 'archived' | 'trending' | 'release'

interface Alert {
  id: string
  type: AlertType
  repoId: string
  repoName: string
  message: string
  timestamp: string
  meta?: {
    tagName?: string
    releaseName?: string
  }
}

const STORAGE_KEY = 'stardash_dismissed_alerts'

export function ProactiveAlerts({ repos, userId }: ProactiveAlertsProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)

  // Load dismissed alerts from localStorage
  useEffect(() => {
    if (!userId) return
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`)
      if (stored) {
        setDismissedAlerts(new Set(JSON.parse(stored)))
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [userId])

  // Save dismissed alerts to localStorage
  const dismissAlert = (alertId: string) => {
    const newDismissed = new Set(dismissedAlerts)
    newDismissed.add(alertId)
    setDismissedAlerts(newDismissed)
    if (userId) {
      try {
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify([...newDismissed]))
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  // Generate alerts based on repo health signals
  const alerts = useMemo((): Alert[] => {
    const newAlerts: Alert[] = []

    for (const repo of repos) {
      // Archived alert
      if (repo.archived) {
        const alertId = `archived-${repo.id}`
        if (!dismissedAlerts.has(alertId)) {
          newAlerts.push({
            id: alertId,
            type: 'archived',
            repoId: repo.id,
            repoName: repo.fullName,
            message: `${repo.fullName} was archived`,
            timestamp: new Date().toISOString(),
          })
        }
      }

      // Trending alert
      if (repo.isTrending) {
        const alertId = `trending-${repo.id}`
        if (!dismissedAlerts.has(alertId)) {
          newAlerts.push({
            id: alertId,
            type: 'trending',
            repoId: repo.id,
            repoName: repo.fullName,
            message: `${repo.fullName} doubled in stars this month`,
            timestamp: new Date().toISOString(),
          })
        }
      }

      // New release alert
      if (repo.latestRelease) {
        const alertId = `release-${repo.id}-${repo.latestRelease.tagName}`
        if (!dismissedAlerts.has(alertId)) {
          newAlerts.push({
            id: alertId,
            type: 'release',
            repoId: repo.id,
            repoName: repo.fullName,
            message: `${repo.fullName} released ${repo.latestRelease.tagName}`,
            timestamp: new Date().toISOString(),
            meta: {
              tagName: repo.latestRelease.tagName,
              releaseName: repo.latestRelease.name,
            },
          })
        }
      }
    }

    return newAlerts
  }, [repos, dismissedAlerts])

  // Don't show the section if there are no alerts
  if (alerts.length === 0) return null

  const displayedAlerts = expanded ? alerts : alerts.slice(0, 3)
  const hasMore = alerts.length > 3

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'archived':
        return <Archive className="h-4 w-4 text-amber-500" />
      case 'trending':
        return <TrendingUp className="h-4 w-4 text-emerald-500" />
      case 'release':
        return <Package className="h-4 w-4 text-blue-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getAlertBadge = (type: AlertType) => {
    switch (type) {
      case 'archived':
        return (
          <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">
            Archived
          </Badge>
        )
      case 'trending':
        return (
          <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
            Trending
          </Badge>
        )
      case 'release':
        return (
          <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
            Release
          </Badge>
        )
    }
  }

  return (
    <Card className="mb-6 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Updates on your stars</CardTitle>
            <Badge variant="secondary" className="text-xs h-5">
              {alerts.length}
            </Badge>
          </div>
          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Dismiss all alerts
                const allAlertIds = alerts.map(a => a.id)
                const newDismissed = new Set([...dismissedAlerts, ...allAlertIds])
                setDismissedAlerts(newDismissed)
                if (userId) {
                  try {
                    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify([...newDismissed]))
                  } catch {
                    // Ignore localStorage errors
                  }
                }
              }}
            >
              Dismiss all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {displayedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-center justify-between gap-3 p-2.5 rounded-lg",
                "bg-muted/50 hover:bg-muted transition-colors group"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                {getAlertIcon(alert.type)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate">
                      <span className="font-medium">{alert.repoName}</span>
                      {' '}
                      {alert.type === 'archived' && 'was archived'}
                      {alert.type === 'trending' && 'doubled in stars this month'}
                      {alert.type === 'release' && `released ${alert.meta?.tagName || 'a new version'}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {getAlertBadge(alert.type)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => dismissAlert(alert.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-8 text-xs text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {alerts.length - 3} more
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
