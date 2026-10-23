import manifest from '../data/docs.json'
import type { DocCategory, DocItem, DocsManifest } from '../types'

const data = manifest as unknown as DocsManifest

export function getAllDocs(): DocItem[] {
  return data.docs
}

export function getCategories(): DocCategory[] {
  return data.categories
}

export function getDocBySlug(slug: string): DocItem | undefined {
  if (!slug || slug === 'index') {
    return data.docs[0]
  }
  return data.docs.find((d) => d.slug === slug || d.id === slug) || data.docs[0]
}

export function getAdjacentDocs(currentSlug: string): { prev?: DocItem; next?: DocItem } {
  const index = data.docs.findIndex((d) => d.slug === currentSlug || d.id === currentSlug)
  if (index === -1) return {}

  return {
    prev: index > 0 ? data.docs[index - 1] : undefined,
    next: index < data.docs.length - 1 ? data.docs[index + 1] : undefined
  }
}

export interface SearchResult {
  doc: DocItem
  score: number
  matchedSnippet: string
}

export function searchDocs(query: string): SearchResult[] {
  if (!query || query.trim().length === 0) return []

  const q = query.toLowerCase().trim()
  const terms = q.split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  for (const doc of data.docs) {
    let score = 0
    const titleLower = doc.title.toLowerCase()
    const slugLower = doc.slug.toLowerCase()
    const snippetLower = doc.searchSnippet.toLowerCase()
    const contentLower = doc.content.toLowerCase()

    // Title match has highest weight
    if (titleLower.includes(q)) score += 50
    if (slugLower.includes(q)) score += 30

    for (const term of terms) {
      if (titleLower.includes(term)) score += 15
      if (slugLower.includes(term)) score += 10
      if (snippetLower.includes(term)) score += 5
      else if (contentLower.includes(term)) score += 2
    }

    if (score > 0) {
      // Find a snippet around the match
      let matchIdx = contentLower.indexOf(terms[0] || q)
      if (matchIdx === -1) matchIdx = 0
      const start = Math.max(0, matchIdx - 40)
      const end = Math.min(doc.content.length, matchIdx + 120)
      const matchedSnippet =
        (start > 0 ? '...' : '') +
        doc.content
          .slice(start, end)
          .replace(/[#*`_\[\]]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() +
        (end < doc.content.length ? '...' : '')

      results.push({ doc, score, matchedSnippet })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 15)
}
