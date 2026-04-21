import type { SVGProps } from "react"
import { siGithub } from "simple-icons"

export function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  const { "aria-label": ariaLabel, ...svgProps } = props

  return (
    <svg
      role={ariaLabel ? "img" : undefined}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      {...svgProps}
    >
      <path d={siGithub.path} />
    </svg>
  )
}
