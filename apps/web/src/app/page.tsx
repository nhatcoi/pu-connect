'use client'

import React, { useEffect, useState } from 'react'
import { Sidebar } from '@/components/social/sidebar'
import { PostCard } from '@/components/social/post-card'
import { DocumentCard } from '@/components/social/document-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store'
import type { PostItem, DocumentItem } from '@pu/schemas'
import { Sparkles, FileUp, Filter, TrendingUp, Search } from 'lucide-react'

const INITIAL_POSTS: PostItem[] = [
  {
    id: 'post_1',
    authorId: 'user_1',
    author: {
      id: 'user_1',
      username: 'techlead',
      displayName: 'Alex Nguyễn',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
    },
    title: 'Kiến trúc Monorepo hiệu năng cao với Turborepo + Next.js + NestJS',
    content: `Chào anh em! Dưới đây là sơ đồ luồng dữ liệu kiến trúc Monorepo chuẩn kết hợp **Turborepo**, **Next.js (Web)**, **React Native (Mobile)** và **NestJS (API)**:

\`\`\`mermaid
graph TD
  Client[Web Next.js / Mobile React Native] -->|GraphQL / REST| Gateway[NestJS API Gateway]
  Gateway -->|Auth / Guard| Service[Core Microservices]
  Service -->|Data Persistence| DB[(PostgreSQL + pgvector)]
  Service -->|Job Queue| Redis[(Redis / BullMQ)]
  Client -->|Direct Upload Presigned URL| S3[(AWS S3 / Cloudflare R2)]
\`\`\`

### Công thức tính toán tối ưu bộ nhớ đệm:
Hệ số tối ưu hóa truy xuất $CacheHitRate$ được biểu diễn như sau:

$$\\eta = \\frac{H_{hits}}{H_{hits} + M_{misses}} \\times 100\\%$$

### Ví dụ code Schema Zod dùng chung:
\`\`\`typescript
import { z } from 'zod';

export const UserContract = z.object({
  id: z.string().uuid(),
  role: z.enum(['admin', 'member']),
  token: z.string()
});
\`\`\`
`,
    tags: ['monorepo', 'nextjs', 'nestjs', 'architecture'],
    mediaUrls: [],
    attachedDocumentIds: ['doc_1'],
    likesCount: 42,
    commentsCount: 9,
    sharesCount: 15,
    isLikedByMe: false,
    createdAt: '15 phút trước',
    updatedAt: '15 phút trước'
  },
  {
    id: 'post_2',
    authorId: 'user_2',
    author: {
      id: 'user_2',
      username: 'datascientist',
      displayName: 'Minh Trang',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80'
    },
    title: 'Chia sẻ tài liệu thuật toán tìm kiếm vector trong xử lý tài liệu AI',
    content: `Mình vừa hoàn thành bộ tài liệu và notebook thực nghiệm so sánh hiệu năng của **HNSW** và **IVFFlat** khi lập chỉ mục vector cho 1.000.000 tài liệu PDF.

Độ phức tạp tính toán xấp xỉ: $\\mathcal{O}(d \\log N)$ trong đó $d$ là số chiều embedding vector.

Tài liệu đính kèm bên dưới, mọi người tải về tham khảo nhé!`,
    tags: ['ai', 'vector-search', 'machine-learning', 'pdf'],
    mediaUrls: [],
    attachedDocumentIds: ['doc_2'],
    likesCount: 68,
    commentsCount: 14,
    sharesCount: 22,
    isLikedByMe: true,
    createdAt: '1 giờ trước',
    updatedAt: '1 giờ trước'
  }
]

const INITIAL_DOCUMENTS: DocumentItem[] = [
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
    createdAt: 'Hôm qua',
    updatedAt: 'Hôm qua'
  },
  {
    id: 'doc_2',
    ownerId: 'user_2',
    owner: {
      id: 'user_2',
      username: 'datascientist',
      displayName: 'Minh Trang',
      avatarUrl: null
    },
    title: 'vector_search_benchmarks.ipynb',
    description: 'Jupyter Notebook chứa toàn bộ script kiểm thử hiệu năng tìm kiếm tương đồng vector với Python và Faiss.',
    type: 'code',
    fileUrl: 'https://example.com/docs/benchmarks.ipynb',
    fileSize: 1250000,
    mimeType: 'application/x-ipynb+json',
    tags: ['ai', 'python', 'faiss'],
    downloadCount: 540,
    viewCount: 2180,
    visibility: 'public',
    createdAt: '2 ngày trước',
    updatedAt: '2 ngày trước'
  },
  {
    id: 'doc_3',
    ownerId: 'user_3',
    owner: {
      id: 'user_3',
      username: 'frontend_master',
      displayName: 'Hoàng Nam',
      avatarUrl: null
    },
    title: 'shadcn_ui_design_tokens_matrix.xlsx',
    description: 'Bảng mapping toàn bộ CSS variables, Radix primitives và NativeWind utility classes cho Web và Mobile.',
    type: 'sheet',
    fileUrl: 'https://example.com/docs/tokens.xlsx',
    fileSize: 340000,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    tags: ['ui', 'shadcn', 'design-system'],
    downloadCount: 890,
    viewCount: 3450,
    visibility: 'public',
    createdAt: '3 ngày trước',
    updatedAt: '3 ngày trước'
  }
]

export default function HomePage() {
  const [currentTab, setCurrentTab] = useState<'feed' | 'documents' | 'explore' | 'bookmarks'>('feed')
  const posts = useAppStore((state) => state.posts)
  const setPosts = useAppStore((state) => state.setPosts)
  const documents = useAppStore((state) => state.documents)
  const setDocuments = useAppStore((state) => state.setDocuments)
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)

  useEffect(() => {
    if (posts.length === 0) {
      setPosts(INITIAL_POSTS)
    }
    if (documents.length === 0) {
      setDocuments(INITIAL_DOCUMENTS)
    }
  }, [posts.length, documents.length, setPosts, setDocuments])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex gap-8">
        {/* Left Navigation Sidebar */}
        <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

        {/* Center Main Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Quick Post Composer Banner */}
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
              VN
            </div>
            <button
              onClick={() => setCreatePostOpen(true)}
              className="flex-1 rounded-lg bg-muted/50 px-4 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              Chia sẻ kiến thức, bài viết kỹ thuật, hoặc đính kèm tài liệu...
            </button>
            <Button size="sm" onClick={() => setCreatePostOpen(true)} className="gap-1.5 text-xs">
              <Sparkles className="h-4 w-4" /> Đăng bài
            </Button>
          </div>

          {/* View Mode Switching Tabs */}
          <div className="flex items-center justify-between">
            <Tabs
              value={currentTab === 'documents' ? 'documents' : 'feed'}
              onValueChange={(val) => setCurrentTab(val as 'feed' | 'documents')}
              className="w-auto"
            >
              <TabsList>
                <TabsTrigger value="feed">Bảng tin mạng xã hội</TabsTrigger>
                <TabsTrigger value="documents">Kho tài liệu ({documents.length})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Filter className="h-3.5 w-3.5" /> Bộ lọc
              </Button>
            </div>
          </div>

          {/* Dynamic Content Switching */}
          {currentTab === 'documents' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        {/* Right Info & Recommendation Sidebar */}
        <aside className="w-80 shrink-0 space-y-6 hidden xl:block">
          <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Thống kê nền tảng</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-muted-foreground">Bài viết kỹ thuật</p>
                <p className="font-bold text-lg mt-0.5">1,420</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-muted-foreground">Tài liệu chia sẻ</p>
                <p className="font-bold text-lg mt-0.5">850</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
            <p className="font-semibold text-sm">Tác giả nổi bật</p>
            <div className="space-y-3">
              {[
                { name: 'Alex Nguyễn', role: 'Solutions Architect', followers: '1.2k' },
                { name: 'Minh Trang', role: 'AI / Data Scientist', followers: '940' },
                { name: 'Hoàng Nam', role: 'Senior Frontend Dev', followers: '820' }
              ].map((author) => (
                <div key={author.name} className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-medium text-foreground">{author.name}</p>
                    <p className="text-muted-foreground text-[11px]">{author.role}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                    Theo dõi
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
