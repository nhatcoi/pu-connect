import type mermaidNamespace from 'mermaid'

type MermaidApi = typeof mermaidNamespace

let mermaidModulePromise: Promise<MermaidApi> | null = null

export function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((mod) => mod.default)
  }
  return mermaidModulePromise
}

let renderQueue: Promise<void> = Promise.resolve()

export function enqueueMermaidRender(fn: () => Promise<void>): void {
  renderQueue = renderQueue.then(fn, fn).then(() => {
    renderQueue = Promise.resolve()
  })
}

export function getMermaidConfig(isDark: boolean) {
  return {
    startOnLoad: false,
    theme: isDark ? ('dark' as const) : ('default' as const),
    securityLevel: 'strict' as const,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
  }
}
