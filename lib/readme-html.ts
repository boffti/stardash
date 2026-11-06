import rehypeRaw from "rehype-raw"

type HastNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const DROP = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "link",
  "meta",
  "base",
  "style",
  "noscript",
  "frame",
  "frameset",
])

function isUnsafeUrl(value: string) {
  const trimmed = value.trim()
  if (/^(javascript|vbscript):/i.test(trimmed)) return true
  if (/^data:/i.test(trimmed) && !/^data:image\//i.test(trimmed)) return true
  return false
}

function alignClass(align: string) {
  if (align === "center") return "text-center"
  if (align === "right") return "text-right"
  return "text-left"
}

function scrub(node: HastNode) {
  const children = node.children
  if (!children) return
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i]
    if (child.type === "element" && child.tagName && DROP.has(child.tagName)) {
      children.splice(i, 1)
      continue
    }
    if (child.type === "element" && child.properties) {
      const props = child.properties
      for (const key of Object.keys(props)) {
        if (/^on/i.test(key)) delete props[key]
      }
      for (const attr of ["href", "src", "poster", "action", "xlinkHref"]) {
        const value = props[attr]
        if (typeof value === "string" && isUnsafeUrl(value)) delete props[attr]
      }
      if (typeof props.align === "string") {
        const existing = props.className
        const classes = Array.isArray(existing)
          ? existing.filter((item): item is string => typeof item === "string")
          : typeof existing === "string"
            ? [existing]
            : []
        props.className = [...classes, alignClass(props.align)]
        delete props.align
      }
    }
    scrub(child)
  }
}

function rehypeStripDangerous() {
  return (tree: HastNode) => {
    scrub(tree)
  }
}

export const readmeRehypePlugins = [rehypeRaw, rehypeStripDangerous]

export function resolveRepoUrl(
  href: string | undefined,
  owner: string,
  repo: string,
  kind: "img" | "link",
) {
  if (!href) return ""
  if (/^(https?:|data:|mailto:|#)/i.test(href)) return href
  const path = href.replace(/^\.\//, "").replace(/^\//, "")
  if (kind === "img") return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`
  return `https://github.com/${owner}/${repo}/blob/HEAD/${path}`
}
