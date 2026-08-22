import { StateCreator } from 'zustand'
import type { DocumentItem, DocumentType } from '@pu/schemas'

export interface DocumentSlice {
  documents: DocumentItem[]
  selectedTypeFilter: DocumentType | 'all'
  searchQuery: string
  isCreateDocumentOpen: boolean
  previewDocument: DocumentItem | null
  setDocuments: (documents: DocumentItem[]) => void
  addDocument: (doc: DocumentItem) => void
  setTypeFilter: (filter: DocumentType | 'all') => void
  setSearchQuery: (query: string) => void
  setCreateDocumentOpen: (open: boolean) => void
  setPreviewDocument: (doc: DocumentItem | null) => void
}

export const createDocumentSlice: StateCreator<DocumentSlice> = (set) => ({
  documents: [],
  selectedTypeFilter: 'all',
  searchQuery: '',
  isCreateDocumentOpen: false,
  previewDocument: null,
  setDocuments: (documents) => set({ documents }),
  addDocument: (doc) => set((state) => ({ documents: [doc, ...state.documents] })),
  setTypeFilter: (filter) => set({ selectedTypeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCreateDocumentOpen: (isCreateDocumentOpen) => set({ isCreateDocumentOpen }),
  setPreviewDocument: (previewDocument) => set({ previewDocument })
})
