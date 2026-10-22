import React, { useEffect, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Newspaper,
  RefreshCw,
  Send,
  Sparkles
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { ArticleCard } from './components/ArticleCard'
import { ConfigModal, DEFAULT_CONFIG, type AppConfig } from './components/ConfigModal'
import { Header } from './components/Header'
import { SearchBar } from './components/SearchBar'
import { exportToExcel, exportToJson, type ArticleItem } from './lib/excel'

export function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('ai_news_theme') === 'dark'
    } catch {
      return false
    }
  })

  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('ai_news_config')
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })

  const [configOpen, setConfigOpen] = useState(false)
  const [topic, setTopic] = useState('ai')
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState('en')
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingTeleId, setSendingTeleId] = useState<string | null>(null)
  const [sendingDigest, setSendingDigest] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('ai_news_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig)
    localStorage.setItem('ai_news_config', JSON.stringify(newConfig))
  }

  // Thu thập và tóm tắt AI
  const handleSearch = async () => {
    try {
      setLoading(true)
      // Bước 1: Crawl tin tức từ RSS Google News
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, query, lang, limit: 8 })
      })

      if (!searchRes.ok) {
        const err = await searchRes.json()
        throw new Error(err.error || 'Lỗi khi thu thập tin tức')
      }

      const searchData = await searchRes.json()
      const rawArticles = searchData.articles || []

      if (!rawArticles.length) {
        toast.info('Không tìm thấy bài báo nào cho chủ đề này.')
        setArticles([])
        return
      }

      toast.info(`Đã tìm thấy ${rawArticles.length} bài báo. Đang tiến hành AI tóm tắt...`)

      // Bước 2: Gọi LLM tóm tắt sang tiếng Việt
      const sumRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: rawArticles, config })
      })

      if (!sumRes.ok) {
        const err = await sumRes.json()
        throw new Error(err.error || 'Lỗi khi AI tóm tắt bài viết')
      }

      const sumData = await sumRes.json()
      setArticles(sumData.articles || rawArticles)
      toast.success(`Đã tóm tắt hoàn tất ${sumData.articles?.length || 0} bài báo!`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Có lỗi xảy ra khi xử lý')
    } finally {
      setLoading(false)
    }
  }

  // Tải Excel
  const handleExportExcel = async () => {
    if (!articles.length) return
    try {
      await exportToExcel(articles)
      toast.success('Đã tải xuống file Excel báo cáo!')
    } catch (e: any) {
      toast.error('Lỗi khi xuất file Excel: ' + e.message)
    }
  }

  // Tải JSON
  const handleExportJson = () => {
    if (!articles.length) return
    exportToJson(articles)
    toast.success('Đã tải xuống file JSON!')
  }

  // Bắn 1 bài qua Telegram
  const handleSendTelegram = async (article: ArticleItem) => {
    if (!config.botToken || !config.chatId) {
      toast.error('Vui lòng vào "Cấu hình" điền Bot Token và Chat ID trước!')
      setConfigOpen(true)
      return
    }

    try {
      setSendingTeleId(article.id)
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: config.botToken,
          chatId: config.chatId,
          article
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi gửi Telegram')

      toast.success('Đã gửi bài viết qua Telegram!')
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi tin qua Telegram')
    } finally {
      setSendingTeleId(null)
    }
  }

  // Bắn toàn bộ Digest qua Telegram
  const handleSendDigestTelegram = async () => {
    if (!articles.length) return
    if (!config.botToken || !config.chatId) {
      toast.error('Vui lòng vào "Cấu hình" điền Bot Token và Chat ID trước!')
      setConfigOpen(true)
      return
    }

    try {
      setSendingDigest(true)
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: config.botToken,
          chatId: config.chatId,
          digest: articles
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi gửi Telegram Digest')

      toast.success(`Đã gửi Bản tin Digest (${articles.length} bài) qua Telegram!`)
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi Digest Telegram')
    } finally {
      setSendingDigest(false)
    }
  }

  // Tự động tìm kiếm lần đầu khi mở app
  useEffect(() => {
    handleSearch()
  }, [])

  return (
    <div className="min-h-screen bg-surface pb-16 transition-colors">
      <Toaster position="top-right" richColors />

      {/* Header thanh điều hướng */}
      <Header
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(!darkMode)}
        onOpenConfig={() => setConfigOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Bộ tìm kiếm & Chọn lĩnh vực */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <SearchBar
            selectedTopic={topic}
            onSelectTopic={(t) => {
              setTopic(t)
              setQuery('')
            }}
            query={query}
            onChangeQuery={setQuery}
            lang={lang}
            onChangeLang={setLang}
            loading={loading}
            onSearch={handleSearch}
          />
        </div>

        {/* Thanh công cụ xuất & Thống kê */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">
              Bản tin đã xử lý ({articles.length})
            </h2>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
              Model: {config.model || 'n7ai-per'}
            </span>
          </div>

          {articles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
                <span>Tải Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
              >
                <FileText className="size-3.5 text-blue-600" />
                <span>Tải JSON</span>
              </button>

              <button
                type="button"
                disabled={sendingDigest}
                onClick={handleSendDigestTelegram}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
              >
                <Send className="size-3.5" />
                <span>{sendingDigest ? 'Đang gửi…' : 'Bắn Digest Tele'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Danh sách bài viết */}
        {articles.length === 0 && !loading ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-xs">
            <Newspaper className="mx-auto size-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-bold text-foreground">Chưa có bài báo nào</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bấm nút "Tìm & Tóm tắt AI" ở trên để hệ thống tự động quét và dịch tóm tắt tin tức.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {articles.map((art) => (
              <ArticleCard
                key={art.id}
                article={art}
                onSendTelegram={handleSendTelegram}
                sendingTelegram={sendingTeleId === art.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal Cấu hình */}
      <ConfigModal
        open={configOpen}
        config={config}
        onClose={() => setConfigOpen(false)}
        onSave={handleSaveConfig}
      />
    </div>
  )
}
