import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { Paperclip } from 'lucide-react'
import type { SharedAiMessage, SharedAiThread } from '@pu/schemas'
import { N7AiMark } from '@/components/brand/pu-logo'
import { AiMessageBody } from '@/components/chat/ai/ai-message-body'

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:4000'
const UNTITLED = 'Cuộc trò chuyện với N7AI'

// Đọc ở server (SEO / xem trước link): link bị ngắt ⇒ 404; không cache vì chủ thread có thể ngắt bất cứ lúc nào
// cache(): metadata và trang dùng chung 1 lần gọi
const loadShare = cache(async (token: string): Promise<SharedAiThread | null> => {
  const res = await fetch(`${API_URL}/api/ai/shared/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Không tải được hội thoại chia sẻ (${res.status})`)
  return ((await res.json()) as { data: SharedAiThread }).data
})

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await loadShare((await params).token)
  if (!share) return { title: 'Không tìm thấy — N7AI', robots: { index: false } }
  const title = `${share.title || UNTITLED} — N7AI`
  const first = share.messages.find((m) => m.role === 'user')?.content.slice(0, 160)
  // Không cho máy tìm kiếm lập chỉ mục: chỉ người có link mới xem
  return { title, description: first || 'Hội thoại học tập với N7AI trên PU Connect', robots: { index: false, follow: false }, openGraph: { title } }
}

// /share/[token]: hội thoại N7AI được chia sẻ công khai (ảnh chụp, chỉ đọc, không cần đăng nhập)
export default async function SharedThreadPage({ params }: Props) {
  const share = await loadShare((await params).token)
  if (!share) notFound()
  const sharedAt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(share.sharedAt)
  )

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl md:text-2xl font-semibold break-words">{share.title || UNTITLED}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Chia sẻ ngày {sharedAt} · nội dung do AI tạo có thể chưa chính xác</p>
      </header>
      <div className="space-y-5">
        {share.messages.map((m) => (m.role === 'user' ? <UserTurn key={m.id} message={m} /> : <AiTurn key={m.id} message={m} />))}
      </div>
    </article>
  )
}

function UserTurn({ message: m }: { message: SharedAiMessage }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {m.content && (
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground whitespace-pre-wrap break-words">
          {m.content}
        </p>
      )}
      {m.attachmentCount > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Paperclip className="h-3 w-3" /> {m.attachmentCount} tệp đính kèm (không chia sẻ)
        </span>
      )}
    </div>
  )
}

function AiTurn({ message: m }: { message: SharedAiMessage }) {
  return (
    <div className="flex items-start gap-2.5">
      <N7AiMark className="h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-card px-3.5 py-2.5 text-sm ring-1 ring-border">
        <AiMessageBody message={{ content: m.content, status: 'done', blocks: m.citations, meta: m.aiMode ? { aiMode: m.aiMode } : null }} />
      </div>
    </div>
  )
}
