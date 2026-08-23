'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  X,
  Clock,
  TrendingUp,
  BookOpen,
  FileText,
  MessageSquare,
  User,
  Users,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import type { SearchResult } from '@pu/schemas'
import { cn } from '@/lib/utils'

const RECENT_SEARCHES_KEY = 'pu_recent_searches'
const HOT_TAGS = ['IT101', 'DoAnTotNghiep', 'GiaiTich2', 'DeThi', 'DevOps', 'Y học']

interface AcademicSearchBarProps {
  className?: string
  initialQuery?: string
  autoFocus?: boolean
}

export function AcademicSearchBar({ className, initialQuery = '', autoFocus = false }: AcademicSearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [isOpen, setIsOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load recent searches from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (saved) {
        setRecentSearches(JSON.parse(saved))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced live search preview
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setPreviewResult(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const timeoutId = setTimeout(async () => {
      try {
        const res = await apiClient<{ success: boolean; data: SearchResult }>(
          `/search?q=${encodeURIComponent(query.trim())}&limit=3`
        )
        if (res && res.data) {
          setPreviewResult(res.data)
        }
      } catch {
        setPreviewResult(null)
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [query])

  const saveRecentSearch = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const updated = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6)
    setRecentSearches(updated)
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }

  const removeRecentSearch = (e: React.MouseEvent, text: string) => {
    e.stopPropagation()
    const updated = recentSearches.filter((s) => s !== text)
    setRecentSearches(updated)
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }

  const handleSubmit = (targetQuery?: string) => {
    const finalQuery = (targetQuery || query).trim()
    if (!finalQuery) return
    saveRecentSearch(finalQuery)
    setIsOpen(false)
    router.push(`/search?q=${encodeURIComponent(finalQuery)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full max-w-md', className)}>
      {/* Input Box */}
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border px-3.5 py-2 transition-all duration-200',
          isOpen
            ? 'border-primary/50 bg-background shadow-md ring-2 ring-primary/10'
            : 'border-border bg-muted/40 hover:border-border/80 hover:bg-muted/60'
        )}
      >
        <Search className={cn('h-4 w-4 shrink-0 transition-colors', isOpen ? 'text-primary' : 'text-muted-foreground')} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder="Tìm môn học, đề thi, bài viết, sinh viên..."
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        {query && !isLoading && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setPreviewResult(null)
            }}
            className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Floating Popover Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="max-h-[420px] overflow-y-auto p-2 space-y-3">
            {/* Live Autocomplete Results */}
            {query.trim().length >= 2 && previewResult ? (
              <div className="space-y-2.5">
                {/* Courses */}
                {previewResult.courses && previewResult.courses.length > 0 && (
                  <div>
                    <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" /> Môn học & Học phần
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {previewResult.courses.map((course) => (
                        <div
                          key={course.id}
                          onClick={() => {
                            saveRecentSearch(course.code)
                            setIsOpen(false)
                            router.push(`/home?tab=courses&course=${course.code}`)
                          }}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-primary font-mono">{course.code}</span>
                            <span className="truncate text-foreground">{course.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{course.credits} tín chỉ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {previewResult.documents && previewResult.documents.length > 0 && (
                  <div>
                    <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> Tài liệu & Đề thi
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {previewResult.documents.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => handleSubmit(doc.title)}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-primary font-semibold">[{doc.type.toUpperCase()}]</span>
                            <span className="truncate text-foreground">{doc.title}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{doc.downloadCount} tải</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posts */}
                {previewResult.posts && previewResult.posts.length > 0 && (
                  <div>
                    <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> Bài viết & Thảo luận
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {previewResult.posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => {
                            setIsOpen(false)
                            router.push(`/#post-${post.id}`)
                          }}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted cursor-pointer transition-colors"
                        >
                          <span className="truncate text-foreground font-medium">{post.title || post.content.slice(0, 50)}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{post.likesCount} ❤️</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users */}
                {previewResult.users && previewResult.users.length > 0 && (
                  <div>
                    <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3" /> Sinh viên & Giảng viên
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {previewResult.users.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setIsOpen(false)
                            router.push(`/${u.username}`)
                          }}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{u.displayName}</span>
                            <span className="text-[11px] text-muted-foreground">@{u.username}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{u.faculty || 'PU'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* View All Button */}
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer mt-2"
                >
                  <span>Xem tất cả kết quả cho &ldquo;{query}&rdquo;</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              /* Default State: Recent Searches & Hot Topics */
              <div className="space-y-3 p-1">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-2 pb-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> Tìm kiếm gần đây
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentSearches([])
                          localStorage.removeItem(RECENT_SEARCHES_KEY)
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {recentSearches.map((item) => (
                        <div
                          key={item}
                          onClick={() => {
                            setQuery(item)
                            handleSubmit(item)
                          }}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer transition-colors group"
                        >
                          <span className="truncate">{item}</span>
                          <button
                            type="button"
                            onClick={(e) => removeRecentSearch(e, item)}
                            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hot Academic Topics */}
                <div>
                  <span className="px-2 text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 pb-1.5">
                    <TrendingUp className="h-3 w-3 text-rose-500" /> Chủ đề & Môn học xu hướng
                  </span>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {HOT_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setQuery(tag)
                          handleSubmit(tag)
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/50 hover:bg-muted transition-colors cursor-pointer"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
