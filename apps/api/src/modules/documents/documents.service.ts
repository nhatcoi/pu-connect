import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreateDocumentInput, DocumentItem } from '@pu/schemas'

@Injectable()
export class DocumentsService {
  private documents: DocumentItem[] = [
    {
      id: 'doc_1',
      ownerId: 'user_1',
      owner: {
        id: 'user_1',
        username: 'techlead',
        displayName: 'Alex Nguyễn',
        avatarUrl: null
      },
      title: 'System Architecture Specification v2.4.pdf',
      description: 'Tài liệu đặc tả kiến trúc hệ thống mạng xã hội mở rộng và xử lý tài liệu phân tán.',
      type: 'pdf',
      fileUrl: 'https://example.com/docs/system-spec.pdf',
      fileSize: 4850000,
      mimeType: 'application/pdf',
      tags: ['architecture', 'system-design', 'spec'],
      downloadCount: 312,
      viewCount: 1420,
      visibility: 'public',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  async findAll(type?: string, search?: string): Promise<DocumentItem[]> {
    return this.documents.filter((doc) => {
      const matchType = !type || type === 'all' || doc.type === type
      const matchSearch =
        !search ||
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      return matchType && matchSearch
    })
  }

  async findOne(id: string): Promise<DocumentItem> {
    const doc = this.documents.find((d) => d.id === id)
    if (!doc) {
      throw new NotFoundException(`Document with ID ${id} not found`)
    }
    doc.viewCount += 1
    return doc
  }

  async create(ownerId: string, data: CreateDocumentInput): Promise<DocumentItem> {
    const newDoc: DocumentItem = {
      id: `doc_${Date.now()}`,
      ownerId,
      owner: {
        id: ownerId,
        username: 'vietnhat',
        displayName: 'Việt Nhật',
        avatarUrl: null
      },
      title: data.title,
      description: data.description,
      type: data.type,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      tags: data.tags,
      downloadCount: 0,
      viewCount: 0,
      visibility: data.visibility,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.documents.unshift(newDoc)
    return newDoc
  }

  async incrementDownload(id: string): Promise<{ downloadUrl: string }> {
    const doc = await this.findOne(id)
    doc.downloadCount += 1
    return { downloadUrl: doc.fileUrl }
  }
}
