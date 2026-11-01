'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { AiMode } from '@pu/schemas'
import {
  ExplainMark,
  ExploreNextMark,
  PlanMark,
  PracticeMark,
  ResearchMark,
  SolveMark,
  type StarterIcon
} from './starter-icons'
import { chatApi, type DynamicSuggestionItem } from '@/hooks/chat/api'
import { useAiSuggestions } from '@/hooks/chat'
import { cn } from '@/lib/utils'

interface CapabilityStarter {
  id: AiMode
  label: string
  icon: StarterIcon
  defaultPrompt: string
}

const CAPABILITIES: readonly CapabilityStarter[] = [
  {
    id: 'explain',
    label: 'Giải thích',
    icon: ExplainMark,
    defaultPrompt: 'Giải thích chi tiết khái niệm này kèm ví dụ trực quan:'
  },
  {
    id: 'deep_solve',
    label: 'Giải bài',
    icon: SolveMark,
    defaultPrompt: 'Giải bài tập này từng bước và phân tích kết quả:'
  },
  {
    id: 'deep_question',
    label: 'Luyện tập',
    icon: PracticeMark,
    defaultPrompt: 'Tạo 5 câu quiz trắc nghiệm để kiểm tra kiến thức về:'
  },
  {
    id: 'plan',
    label: 'Lập kế hoạch',
    icon: PlanMark,
    defaultPrompt: 'Lập lộ trình ôn thi và học tập theo ngày cho môn:'
  },
  {
    id: 'deep_research',
    label: 'Nghiên cứu',
    icon: ResearchMark,
    defaultPrompt: 'Nghiên cứu và tóm tắt các điểm cốt lõi của chủ đề:'
  }
]

const FALLBACK_DISCIPLINES: readonly DynamicSuggestionItem[] = [
  {
    label: 'Khi nào nên dùng async thay vì threads trong Python/Node.js?',
    prompt: 'So sánh chi tiết giữa mô hình Async I/O (Event Loop) và Multi-threading khi xử lý I/O bound vs CPU bound, kèm benchmark cụ thể:'
  },
  {
    label: 'Cơ chế bắt tay TLS 1.3 và cách HTTPS bảo mật kết nối',
    prompt: 'Giải thích chi tiết luồng bắt tay TLS 1.3 (1-RTT và 0-RTT Handshake), cơ chế Diffie-Hellman và cách HTTPS mã hóa dữ liệu:'
  },
  {
    label: 'So sánh chuẩn 3NF và BCNF trong thiết kế CSDL quan hệ',
    prompt: 'Phân tích điểm khác biệt giữa 3NF và Boyce-Codd (BCNF), kèm ví dụ về Functional Dependency mà 3NF thỏa mãn nhưng BCNF vi phạm:'
  },
  {
    label: 'Nguyên lý đồng thuận của thuật toán Raft trong hệ thống phân tán',
    prompt: 'Giải thích trực quan thuật toán đồng thuận Raft (Leader Election, Log Replication, Safety) trong hệ thống phân tán:'
  },
  {
    label: 'Bản chất cơ chế Scaled Dot-Product Self-Attention trong Transformer',
    prompt: 'Giải thích toán học và trực quan cơ chế Scaled Dot-Product Self-Attention và Multi-Head Attention trong kiến trúc Transformer:'
  },
  {
    label: 'Nguyên lý Leftmost Prefix Rule khi tối ưu Composite Index trong SQL',
    prompt: 'Nguyên lý hoạt động của Leftmost Prefix Rule trong B-Tree Index và cách thiết kế Composite Index tối ưu cho truy vấn phức tạp:'
  },
  {
    label: 'Tại sao HTTP/3 chuyển từ TCP sang UDP (QUIC Protocol)?',
    prompt: 'So sánh chi tiết TCP và UDP về cơ chế kiểm soát tắc nghẽn (Congestion Control), Head-of-Line Blocking và lý do HTTP/3 dùng QUIC:'
  },
  {
    label: 'Thuật toán A* và cách chọn hàm Heuristic tối ưu',
    prompt: 'Nguyên lý của thuật toán A*, cách chọn hàm Heuristic h(n) chấp nhận được (admissible) và so sánh hiệu năng với Dijkstra:'
  },
  {
    label: 'Phân tích đánh đổi giữa Monolith, Microservices và Modular Monolith',
    prompt: 'Phân tích đánh đổi (trade-offs) về độ phức tạp triển khai, latency và consistency giữa Monolith, Microservices và Modular Monolith:'
  },
  {
    label: 'Cơ chế Garbage Collection trong V8 Engine (Scavenge & Mark-Sweep)',
    prompt: 'Giải thích chi tiết cách V8 Engine thu gom rác (Generational Garbage Collection, Young Generation Scavenge, Old Generation Mark-Sweep-Compact):'
  },
  {
    label: 'Sự khác biệt giữa con trỏ và tham chiếu trong C/C++',
    prompt: 'Phân biệt chi tiết giữa pointer (con trỏ) và reference (tham chiếu) trong C/C++, kèm phân tích cách cấp phát bộ nhớ Stack/Heap:'
  },
  {
    label: 'So sánh cân bằng giữa Red-Black Tree và AVL Tree',
    prompt: 'So sánh chi tiết cây cân bằng AVL và Red-Black Tree về chiều cao tối đa, số phép xoay và trường hợp nào nên dùng mỗi loại:'
  },
  {
    label: 'Chiến lược giải quyết Cache Stampede và Cache Penetration trong Redis',
    prompt: 'Phân tích các kỹ thuật xử lý Cache Breakdown, Cache Penetration (Bloom Filter) và Cache Stampede (Mutex lock) trong hệ thống phân tán:'
  },
  {
    label: 'Cơ chế Virtual Memory, Paging và Page Fault trong hệ điều hành',
    prompt: 'Giải thích cơ chế phân trang (Paging), bảng trang (Page Table), TLB Cache và cách hệ điều hành xử lý Page Fault:'
  },
  {
    label: 'Sự khác biệt giữa React Fiber Reconciliation và Virtual DOM cũ',
    prompt: 'Giải thích kiến trúc React Fiber, cơ chế Time Slicing, Concurrent Mode và thuật toán Diffing hai cây phần tử:'
  },
  {
    label: 'Agentic RAG khác gì so với Naive RAG trong xử lý tài liệu?',
    prompt: 'Phân tích điểm khác biệt giữa Agentic RAG (Routing, Query Rewriting, Self-Correction, Multi-hop) và Naive RAG một bước truy xuất:'
  }
]

interface StarterSuggestionsProps {
  activeMode?: AiMode
  onSelectMode?: (mode: AiMode) => void
  onPick: (prompt: string) => void
  disabled?: boolean
}

export function StarterSuggestions({
  activeMode,
  onSelectMode,
  onPick,
  disabled = false
}: StarterSuggestionsProps) {
  const [isRotating, setIsRotating] = useState(false)
  // Khởi tạo ngẫu nhiên trong danh sách fallback để không bao giờ bị cố định ở index 0
  const [currentIdea, setCurrentIdea] = useState<DynamicSuggestionItem>(() => {
    const randomIndex = Math.floor(Math.random() * FALLBACK_DISCIPLINES.length)
    return FALLBACK_DISCIPLINES[randomIndex]
  })

  // Lấy gợi ý động từ backend (Personalized based on recent threads)
  const { data: suggestionsData } = useAiSuggestions(activeMode)

  useEffect(() => {
    if (suggestionsData?.suggestions && suggestionsData.suggestions.length > 0) {
      setCurrentIdea(suggestionsData.suggestions[0])
    }
  }, [suggestionsData])

  // Refresh dynamic suggestion on demand
  const handleRefresh = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (disabled || isRotating) return
      setIsRotating(true)

      try {
        const refreshed = await chatApi.aiRefreshSuggestions(activeMode)
        if (refreshed?.suggestions && refreshed.suggestions.length > 0) {
          setCurrentIdea(refreshed.suggestions[0])
        } else {
          // Xoay vòng trong danh sách fallback nếu offline/chưa có DB
          setCurrentIdea((prev) => {
            const idx = FALLBACK_DISCIPLINES.findIndex((x) => x.label === prev.label)
            return FALLBACK_DISCIPLINES[(idx + 1) % FALLBACK_DISCIPLINES.length]
          })
        }
      } catch {
        setCurrentIdea((prev) => {
          const idx = FALLBACK_DISCIPLINES.findIndex((x) => x.label === prev.label)
          return FALLBACK_DISCIPLINES[(idx + 1) % FALLBACK_DISCIPLINES.length]
        })
      } finally {
        setTimeout(() => setIsRotating(false), 350)
      }
    },
    [activeMode, disabled, isRotating]
  )

  const handlePickCapability = (cap: CapabilityStarter) => {
    onSelectMode?.(cap.id)
    onPick(cap.defaultPrompt)
  }

  return (
    <div className="mx-auto w-full max-w-[768px] px-4 pt-3 pb-3 text-center animate-fade-in select-none">
      {/* 5 N7AI Capability guides */}
      <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 mb-3.5">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon
          const isSelected =
            activeMode === cap.id ||
            (cap.id === 'deep_solve' && (activeMode === 'solve' || activeMode === 'deep_solve')) ||
            (cap.id === 'deep_question' && (activeMode === 'quiz' || activeMode === 'deep_question')) ||
            (cap.id === 'deep_research' &&
              (activeMode === 'research' || activeMode === 'deep_research' || activeMode === 'summarize'))
          return (
            <button
              key={cap.id}
              type="button"
              disabled={disabled}
              onClick={() => handlePickCapability(cap)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all cursor-pointer',
                isSelected
                  ? 'bg-foreground/10 text-foreground font-semibold shadow-xs ring-1 ring-foreground/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]'
              )}
            >
              <Icon className="shrink-0" />
              <span>{cap.label}</span>
            </button>
          )
        })}
      </div>

      {/* Dynamic Advice / Ideas for you line */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-foreground/[0.04] transition-colors max-w-full group">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(currentIdea.prompt)}
            className="inline-flex items-center gap-1.5 text-left min-w-0 transition-colors cursor-pointer"
          >
            <ExploreNextMark className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-[13px] text-muted-foreground shrink-0 font-medium">Gợi ý cho bạn</span>
            <span className="text-[13px] font-normal text-foreground/85 group-hover:text-foreground truncate transition-colors max-w-[340px] sm:max-w-[480px]">
              {currentIdea.label}
            </span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={handleRefresh}
            title="Đổi gợi ý khác"
            aria-label="Đổi gợi ý khác"
            className="ml-1 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08] transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw
              size={12}
              className={cn('transition-transform duration-300', isRotating && 'rotate-180 text-primary')}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
