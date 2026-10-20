import type { Source } from './ai.retrieval'

// Per-reply numbered sources: pinned context and tool results share one citation space.
export class AgentSources {
  constructor(readonly sources: Source[]) {}

  add(source: Source) {
    let index = this.sources.findIndex((s) => s.type === source.type && s.id === source.id)
    if (index < 0) index = this.sources.push(source) - 1
    return index + 1
  }

  preview(source: Source) {
    return { n: this.add(source), type: source.type, id: source.id, title: source.title, excerpt: source.body.slice(0, 450), href: sourceHref(source) }
  }
}

export function sourceHref(source: Pick<Source, 'type' | 'id' | 'title'>): string | undefined {
  if (source.type === 'post') return `/post/${source.id}`
  if (source.type === 'document') return `/search?q=${encodeURIComponent(source.title)}&type=documents`
  if (source.type === 'web' || source.type === 'paper') return source.id
  return undefined
}
