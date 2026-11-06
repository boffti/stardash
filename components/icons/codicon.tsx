import type { ComponentPropsWithoutRef } from "react"
import "@vscode/codicons/dist/codicon.css"
import { cn } from "@/lib/utils"

type CodiconProps = ComponentPropsWithoutRef<"span"> & { name: string }

export function Codicon({ name, className, style, ...props }: CodiconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("codicon", `codicon-${name}`, className)}
      style={{ WebkitTextStrokeWidth: "0.15px", ...style }}
      {...props}
    />
  )
}
