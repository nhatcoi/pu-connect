import { Injectable } from '@nestjs/common'
import type { AiConnectorId } from '@pu/schemas'
import type { AgentToolSession } from './agent-tools'
import { argEnum, argText, toolError, toolResult, toolUnavailable } from './agent-tool-args'
import { AgentSources } from './agent-sources'
import { AiRetrieval } from './ai.retrieval'

const SOURCES = ['my_documents', 'my_groups', 'web', 'web_search', 'semantic_scholar'] as const
const LABELS: Record<(typeof SOURCES)[number], string> = {
  my_documents: 'Tìm tài liệu của tôi',
  my_groups: 'Xem nhóm học của tôi',
  web: 'Đọc trang web',
  web_search: 'Tìm trên web',
  semantic_scholar: 'Tìm bài báo khoa học'
}

const toolDesc = (source: (typeof SOURCES)[number]) => {
  if (source === 'web') return `${LABELS[source]}. query must contain the exact public URL to read.`
  if (source === 'semantic_scholar') {
    return 'Tìm kiếm bài báo khoa học, công trình nghiên cứu trên Semantic Scholar & arXiv (tên bài, tác giả, năm, abstract, trích dẫn, link PDF).'
  }
  return `${LABELS[source]}. Return relevant excerpts only when this source is needed.`
}

// Optional sources are tools, never unconditional prefetch. The selected source is validated again at execution.
@Injectable()
export class RetrievalToolsService {
  constructor(private readonly retrieval: AiRetrieval) {}

  open(userId: string, connectors: AiConnectorId[], catalog: AgentSources, research: boolean): AgentToolSession {
    const selected = SOURCES.filter((s) => connectors.includes(s))
    return {
      tools: selected.map((source) => ({
        type: 'function',
        function: {
          name: `${source}__search`,
          description: toolDesc(source),
          parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false }
        }
      })),
      instructions: selected.length
        ? [
            'Optional sources are available only as tools. Use them only when needed. Returned n values share the numbered PU citation space. For academic papers, cite [nguồn] n and mention paper title, authors, year. For requests about papers, research ideas or literature, call semantic_scholar__search directly (1–2 English keyword queries from the user\'s topic, profile or memory) rather than asking for more detail first.'
          ]
        : [],
      readOnly: () => true,
      describe: (name, args) => {
        const source = argEnum(name.replace(/__search$/, ''), selected)
        return source ? { provider: source, label: LABELS[source], detail: argText(args.query, 60) ?? undefined } : null
      },
      call: async (name, args) => {
        const source = argEnum(name.replace(/__search$/, ''), selected)
        const query = argText(args.query, 400)
        if (!source || name !== `${source}__search` || !query) return toolError('Nguồn hoặc từ khóa không được cấp quyền')
        const result = await this.retrieval.retrieve(query, userId, { connectors: [source], research })
        // Nguồn lỗi (khác "không có kết quả") ⇒ báo lỗi để model không đổi từ khóa gọi lại
        if (!result.sources.length && result.failures.length) return toolUnavailable(`${result.failures[0].message}. Không gọi lại nguồn này trong lượt hỏi này; trả lời bằng kiến thức sẵn có.`)
        return toolResult(
          source,
          result.sources.map((s) => ({ ...catalog.preview(s), excerpt: s.body.slice(0, research ? 3000 : 1800) }))
        )
      },
      close: async () => undefined
    }
  }
}
