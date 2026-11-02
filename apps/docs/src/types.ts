export interface DocHeading {
  level: number
  text: string
  id: string
}

export interface DocItem {
  id: string
  slug: string
  relPath: string
  title: string
  categoryId: string
  order: number
  summary: string
  headings: DocHeading[]
  hasMermaid: boolean
  content: string
  searchSnippet: string
}

export interface DocCategory {
  id: string
  title: string
  description: string
}

export interface DocsManifest {
  generatedAt: string
  totalDocs: number
  categories: DocCategory[]
  docs: DocItem[]
}
