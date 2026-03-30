"use client"

import { useState, useCallback } from "react"
import { Star, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface StarNoteToastProps {
  repoName: string
  onSaveNote: (note: string) => Promise<void>
}

// Custom toast component for adding notes after starring
function StarNoteToastContent({ repoName, onSaveNote }: StarNoteToastProps) {
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!note.trim()) return
    setIsSaving(true)
    try {
      await onSaveNote(note.trim())
      toast.success("Note saved")
    } catch {
      toast.error("Failed to save note")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <span className="font-medium text-sm">Saved to your stars</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {repoName} — add a note?
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Why did you star this?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && note.trim()) {
              handleSave()
            } else if (e.key === "Escape") {
              toast.dismiss()
            }
          }}
          className="h-8 text-sm"
          autoFocus
        />
        <Button
          size="sm"
          className="h-8 px-2"
          onClick={handleSave}
          disabled={!note.trim() || isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Add"
          )}
        </Button>
      </div>
    </div>
  )
}

// Show the star note toast
export function showStarNoteToast(repoName: string, onSaveNote: (note: string) => Promise<void>) {
  const toastId = toast.custom(
    (t) => (
      <div className="bg-background border rounded-lg shadow-lg p-4 relative">
        <button
          onClick={() => toast.dismiss(t)}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
        <StarNoteToastContent repoName={repoName} onSaveNote={onSaveNote} />
      </div>
    ),
    {
      duration: 5000,
      position: "bottom-right",
    }
  )

  return toastId
}

// Hook to handle star note toast with auto-dismiss
export function useStarNoteToast() {
  const showToast = useCallback((repoName: string, onSaveNote: (note: string) => Promise<void>) => {
    return showStarNoteToast(repoName, onSaveNote)
  }, [])

  return { showStarNoteToast: showToast }
}
