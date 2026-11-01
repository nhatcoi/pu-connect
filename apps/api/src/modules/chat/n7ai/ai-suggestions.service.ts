import { Injectable } from '@nestjs/common'
import { ChatCoreService } from '../chat-core.service'

export interface SuggestionItem {
  label: string
  prompt: string
}

export interface SuggestionsResponse {
  suggestions: SuggestionItem[]
  items?: Array<{ text: string; mode: string; topic: null }>
}

const GREETINGS_AND_PLACEHOLDERS = new Set([
  'hi',
  'hello',
  'chào',
  'chào bạn',
  'chào bạn, phenikaa là trường nào nhỉ?',
  'chào nè',
  'ní hảo',
  'new chat',
  'new conversation',
  'untitled',
  'untitled draft',
  'test',
  'alo',
  'hey'
])

const ACADEMIC_DISCIPLINES: SuggestionItem[] = [
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

@Injectable()
export class AiSuggestionsService {
  private userShownIndices = new Map<string, number>()

  constructor(private readonly core: ChatCoreService) {}

  async get(userId: string | null, mode?: string): Promise<SuggestionsResponse> {
    const key = userId || 'anonymous'
    let index = this.userShownIndices.get(key)
    if (index === undefined) {
      // Khởi tạo ngẫu nhiên để không bao giờ bị cố định ở phần tử 0 khi tải trang
      index = Math.floor(Math.random() * ACADEMIC_DISCIPLINES.length)
      this.userShownIndices.set(key, index)
    }
    return this.resolveSuggestion(userId, index, mode)
  }

  async refresh(userId: string | null, mode?: string): Promise<SuggestionsResponse> {
    const key = userId || 'anonymous'
    const currentIndex = this.userShownIndices.get(key) ?? Math.floor(Math.random() * ACADEMIC_DISCIPLINES.length)
    const nextIndex = currentIndex + 1
    this.userShownIndices.set(key, nextIndex)
    return this.resolveSuggestion(userId, nextIndex, mode)
  }

  private async resolveSuggestion(userId: string | null, index: number, mode?: string): Promise<SuggestionsResponse> {
    // 1. Kiểm tra xem người dùng có các chủ đề / hội thoại học tập gần đây không
    if (userId) {
      try {
        const { rows } = await this.core.db.query<{ title: string }>(
          `SELECT title FROM conversations WHERE type = 'ai' AND created_by = $1 AND title IS NOT NULL AND trim(title) <> '' ORDER BY last_message_at DESC NULLS LAST LIMIT 12`,
          [userId]
        )

        // Lọc bỏ các tiêu đề chào hỏi đơn thuần hoặc placeholder
        const validRows = rows.filter((r) => {
          const t = r.title.trim().toLowerCase()
          return t.length >= 6 && !GREETINGS_AND_PLACEHOLDERS.has(t)
        })

        if (validRows.length > 0) {
          const topic = validRows[index % validRows.length].title.trim()
          const dynamicItem = this.generatePromptFromTopic(topic, mode)
          return {
            suggestions: [dynamicItem],
            items: validRows.map((r) => ({
              text: r.title,
              mode: mode || 'ask',
              topic: null
            }))
          }
        }
      } catch {
        // Fallback khi chưa có DB hoặc query lỗi
      }
    }

    // 2. Nếu chưa có lịch sử (hoặc khách), lấy từ danh mục học thuật đa dạng và xoay vòng
    const pool = this.filterByMode(mode)
    const item = pool[index % pool.length]
    return {
      suggestions: [item],
      items: pool.map((p) => ({
        text: p.label,
        mode: mode || 'ask',
        topic: null
      }))
    }
  }

  private generatePromptFromTopic(topic: string, mode?: string): SuggestionItem {
    const tLower = topic.toLowerCase()

    // Nhận diện ngữ cảnh môn học / chủ đề để sinh câu hỏi "bước kế tiếp"
    if (tLower.includes('con trỏ') || tLower.includes('pointer') || tLower.includes('c/c++')) {
      return {
        label: 'Phân biệt con trỏ cấp 1, con trỏ cấp 2 và mảng trong C/C++',
        prompt: 'Giải thích chi tiết sự khác biệt giữa con trỏ (pointer), mảng (array) và con trỏ cấp hai (double pointer) trong C/C++ kèm ví dụ minh họa bộ nhớ Stack/Heap:'
      }
    }
    if (tLower.includes('cấu trúc dữ liệu') || tLower.includes('giải thuật') || tLower.includes('data structure')) {
      return {
        label: 'So sánh độ phức tạp giữa AVL Tree, Red-Black Tree và B-Tree',
        prompt: 'Phân tích so sánh cân bằng độ cao và hiệu năng chèn/xóa giữa cây AVL, Red-Black Tree và B-Tree trong Cấu trúc dữ liệu:'
      }
    }
    if (tLower.includes('ai') || tLower.includes('train') || tLower.includes('mô hình') || tLower.includes('học máy')) {
      return {
        label: 'Kỹ thuật xử lý Overfitting và Imbalanced Data khi huấn luyện AI',
        prompt: 'Phân tích các kỹ thuật xử lý dữ liệu mất cân bằng (Imbalanced Data) và chống Overfitting khi huấn luyện mô hình học sâu:'
      }
    }
    if (tLower.includes('csdl') || tLower.includes('database') || tLower.includes('sql')) {
      return {
        label: 'Cách thiết kế Composite Index tối ưu theo Leftmost Prefix Rule trong SQL',
        prompt: 'Nguyên lý hoạt động của Leftmost Prefix Rule trong B-Tree Index và cách thiết kế Composite Index tối ưu cho truy vấn phức tạp:'
      }
    }
    if (tLower.includes('slide') || tLower.includes('thuyết trình')) {
      return {
        label: `Cấu trúc dàn ý và điểm nhấn học thuật cho bài báo cáo về ${topic}`,
        prompt: `Lập dàn ý chi tiết 10 slide thuyết trình học thuật chuyên nghiệp, súc tích và có chiều sâu cho chủ đề "${topic}":`
      }
    }

    switch (mode) {
      case 'explain':
        return {
          label: `Giải thích bản chất và cơ chế hoạt động của ${topic}`,
          prompt: `Giải thích chi tiết khái niệm và cơ chế hoạt động của "${topic}" với ví dụ trực quan, dễ hiểu:`
        }
      case 'solve':
        return {
          label: `Phương pháp giải và xử lý bài toán liên quan đến ${topic}`,
          prompt: `Hướng dẫn giải chi tiết từng bước cho bài toán về "${topic}", kèm phân tích độ phức tạp thuật toán:`
        }
      case 'practice':
      case 'quiz':
        return {
          label: `Bộ câu hỏi luyện tập và quiz củng cố kiến thức về ${topic}`,
          prompt: `Tạo 5 câu hỏi trắc nghiệm kèm giải thích đáp án chi tiết để kiểm tra hiểu biết về "${topic}":`
        }
      case 'plan':
        return {
          label: `Lộ trình ôn tập 7 ngày để làm chủ ${topic}`,
          prompt: `Lập kế hoạch và lộ trình học tập chi tiết trong 7 ngày để nắm vững kiến thức về "${topic}":`
        }
      case 'research':
      case 'summarize':
        return {
          label: `Nghiên cứu so sánh và phân tích chuyên sâu về ${topic}`,
          prompt: `Nghiên cứu chuyên sâu, tổng hợp các góc nhìn học thuật và tài liệu cốt lõi về "${topic}":`
        }
      default:
        return {
          label: `Phân tích sâu cơ chế và ứng dụng thực tiễn của ${topic}`,
          prompt: `Phân tích chi tiết nguyên lý hoạt động, ưu nhược điểm và ứng dụng thực tế của "${topic}":`
        }
    }
  }

  private filterByMode(mode?: string): SuggestionItem[] {
    if (!mode || mode === 'ask') return ACADEMIC_DISCIPLINES
    return ACADEMIC_DISCIPLINES.map((item) => {
      if (mode === 'explain') {
        return {
          label: `Giải thích bản chất: ${item.label}`,
          prompt: `Giải thích chi tiết với ví dụ trực quan: ${item.prompt}`
        }
      }
      if (mode === 'practice' || mode === 'quiz') {
        return {
          label: `Quiz 5 câu kiểm tra: ${item.label}`,
          prompt: `Tạo bộ câu hỏi quiz trắc nghiệm kèm giải thích đáp án chi tiết: ${item.label}`
        }
      }
      if (mode === 'plan') {
        return {
          label: `Lộ trình 7 ngày ôn tập: ${item.label}`,
          prompt: `Lập kế hoạch và lộ trình học tập từng bước để nắm vững: ${item.label}`
        }
      }
      if (mode === 'research' || mode === 'summarize') {
        return {
          label: `Nghiên cứu học thuật: ${item.label}`,
          prompt: `Nghiên cứu tài liệu chuyên sâu và các góc nhìn học thuật về: ${item.label}`
        }
      }
      return item
    })
  }
}
