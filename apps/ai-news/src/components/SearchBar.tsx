import React from 'react'
import { Filter, Loader2, Search, Sparkles } from 'lucide-react'

export interface TopicDef {
  id: string
  label: string
}

export const TOPICS: TopicDef[] = [
  { id: 'ai', label: 'AI & Học máy' },
  { id: 'tech', label: 'Công nghệ & Phần mềm' },
  { id: 'security', label: 'An ninh mạng' },
  { id: 'robotics', label: 'Robotics & Phần cứng' },
  { id: 'politics', label: 'Chính trị & Thế giới' },
  { id: 'economy', label: 'Kinh tế & Tài chính' },
  { id: 'science', label: 'Khoa học & Đời sống' }
]

export function SearchBar({
  selectedTopic,
  onSelectTopic,
  query,
  onChangeQuery,
  lang,
  onChangeLang,
  loading,
  onSearch
}: {
  selectedTopic: string
  onSelectTopic: (t: string) => void
  query: string
  onChangeQuery: (q: string) => void
  lang: string
  onChangeLang: (l: string) => void
  loading: boolean
  onSearch: () => void
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      onSearch()
    }
  }

  return (
    <div className="space-y-4">
      {/* Danh sách chủ đề (Chips) */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {TOPICS.map((t) => {
          const active = selectedTopic === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTopic(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Thanh tìm kiếm & Ngôn ngữ */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Tìm kiếm tin tức về ${TOPICS.find((t) => t.id === selectedTopic)?.label} hoặc nhập từ khóa tùy chỉnh...`}
            className="w-full rounded-xl border border-input bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={lang}
            onChange={(e) => onChangeLang(e.target.value)}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-xs"
          >
            <option value="en">Nguồn quốc tế (EN)</option>
            <option value="vi">Nguồn trong nước (VI)</option>
          </select>

          <button
            type="button"
            disabled={loading}
            onClick={onSearch}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            <span>{loading ? 'Đang thu thập & AI tóm tắt…' : 'Tìm & Tóm tắt AI'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
