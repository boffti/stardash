'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TokenExpiredBannerProps {
  onReconnect: () => void
}

export function TokenExpiredBanner({ onReconnect }: TokenExpiredBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
      <span className="flex-1 text-amber-700 dark:text-amber-400">
        Your GitHub session has expired. Showing cached data — live sync is unavailable.
      </span>
      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 border-amber-500/40 hover:bg-amber-500/10" onClick={onReconnect}>
        Reconnect GitHub
      </Button>
    </div>
  )
}
