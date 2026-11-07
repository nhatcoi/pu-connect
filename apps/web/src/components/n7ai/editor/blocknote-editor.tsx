'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  type PartialBlock,
} from '@blocknote/core'
import {
  BlockNoteViewRaw,
  useCreateBlockNote,
  FormattingToolbarController,
  SuggestionMenuController,
  useActiveStyles,
} from '@blocknote/react'
import '@blocknote/core/style.css'
import { figureCodeBlock } from './note-figures'
import './notes.css'
import './note-workspace.css'

import {
  Bold,
  Bookmark,
  BookOpen,
  ChevronDown,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Languages,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  PenLine,
  Quote,
  Sparkles,
  Strikethrough,
  Table as TableIcon,
  Underline,
} from 'lucide-react'
import { MathInline, protectMath, restoreMath, exportMath } from './note-math'
import { NoteInsertMenu, type NoteMenuItem } from './note-insert-menu'
import type { BlockPreviewKind } from './block-previews'
import { useAiNoteAsk } from '@/hooks/chat/use-ai-notes'
import { toast } from 'sonner'

function unescapeMarkdownEntities(md: string): string {
  return md
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export function BlockNoteEditorComponent({
  initialMarkdown,
  onChange,
  appendRef,
  noteId,
  onAskAi,
}: {
  initialMarkdown: string
  onChange: (markdown: string) => void
  appendRef?: React.MutableRefObject<((markdown: string) => void) | null>
  noteId: string
  onAskAi?: (prompt: string, selection: string) => void
}) {
  const ask = useAiNoteAsk(noteId)
  const isLoaded = useRef(false)
  const latestMarkdown = useRef(initialMarkdown)

  // Tạo editor instance qua useCreateBlockNote
  const editor = useCreateBlockNote({
    schema: BlockNoteSchema.create({
      blockSpecs: { ...defaultBlockSpecs, codeBlock: figureCodeBlock },
      inlineContentSpecs: { ...defaultInlineContentSpecs, math: MathInline }
    })
  })

  // Parse markdown ban đầu sang blocks của BlockNote
  useEffect(() => {
    if (!editor || isLoaded.current) return
    let active = true
    async function load() {
      if (!initialMarkdown || !initialMarkdown.trim()) {
        isLoaded.current = true
        return
      }
      try {
        const { text, items } = protectMath(unescapeMarkdownEntities(initialMarkdown))
        const parsed = await editor.tryParseMarkdownToBlocks(text)
        const blocks = restoreMath(parsed as any[], items) as any[]
        if (active && blocks && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks)
        }
      } catch (err) {
        console.warn('Error parsing initial markdown to blocks, fallback to paragraphs:', err)
        if (active && initialMarkdown) {
          const paragraphs = unescapeMarkdownEntities(initialMarkdown)
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
          if (paragraphs.length > 0) {
            editor.replaceBlocks(
              editor.document,
              paragraphs.map((p) => ({
                type: 'paragraph' as const,
                content: p,
              }))
            )
          }
        }
      } finally {
        if (active) isLoaded.current = true
      }
    }
    load()
    return () => {
      active = false
    }
  }, [editor, initialMarkdown])

  // Lắng nghe sự kiện thêm nội dung từ bên ngoài (appendRef)
  useEffect(() => {
    if (!appendRef || !editor) return
    appendRef.current = async (md: string) => {
      try {
        const prot = protectMath(md)
        const newBlocks = restoreMath((await editor.tryParseMarkdownToBlocks(prot.text)) as any[], prot.items) as any[]
        if (newBlocks && newBlocks.length > 0) {
          const lastBlock = editor.document[editor.document.length - 1]
          editor.insertBlocks(newBlocks, lastBlock, 'after')
        }
      } catch (err) {
        console.warn('Append markdown error:', err)
      }
    }
    return () => {
      appendRef.current = null
    }
  }, [editor, appendRef])

  // Gọi onChange khi tài liệu thay đổi
  const handleDocChange = useCallback(async () => {
    if (!editor || !isLoaded.current) return
    try {
      const md = exportMath(await editor.blocksToMarkdownLossy(editor.document))
      latestMarkdown.current = md
      onChange(md)
    } catch {
      // Ignored
    }
  }, [editor, onChange])

  // Danh sách các khối trong menu Slash ("/")
  const getSlashMenuItems = useCallback(
    async (query: string): Promise<NoteMenuItem[]> => {
      const q = query.toLowerCase().trim()

      const item = (
        title: string,
        group: string,
        subtext: string,
        aliases: string[],
        icon: React.JSX.Element | undefined,
        onItemClick: () => void,
        preview: BlockPreviewKind,
        shortcut?: string
      ): NoteMenuItem => ({
        title,
        group,
        subtext,
        aliases,
        icon,
        onItemClick,
        preview,
        shortcut,
      })

      const insert = (block: PartialBlock) => {
        const current = editor.getTextCursorPosition().block
        if (current.type === 'paragraph' && !current.content?.length) {
          editor.replaceBlocks([current], [block])
        } else {
          editor.insertBlocks([block], current, 'after')
        }
      }

      const allItems: NoteMenuItem[] = [
        item(
          'Ask N7AI',
          'Suggested',
          'Viết, giải thích hoặc hoàn thiện đoạn ghi chú này.',
          ['ai', 'hỏi', 'n7ai', 'gpt'],
          <Sparkles size={18} className="text-primary" />,
          () => {
            const text = editor.getSelectedText() || ''
            onAskAi?.('', text)
          },
          'ai'
        ),
        item(
          'Reference a source',
          'Suggested',
          'Đưa vào một đoạn trích từ tài liệu học tập hoặc cuộc trò chuyện.',
          ['source', 'nguồn', 'trích dẫn'],
          <BookOpen size={18} />,
          () => {
            insert({
              type: 'paragraph',
              content: [{ type: 'text', text: '📖 [Tài liệu tham khảo]', styles: { italic: true } }],
            })
          },
          'source'
        ),
        item(
          'Insert favorite',
          'Suggested',
          'Lưu lại một câu trả lời mẫu hữu ích từ N7AI.',
          ['favorite', 'lưu', 'yêu thích'],
          <Bookmark size={18} />,
          () => {
            insert({
              type: 'paragraph',
              content: [{ type: 'text', text: '📌 [Nội dung học tập đã lưu]', styles: { italic: true } }],
            })
          },
          'favorite'
        ),
        item(
          'Paragraph',
          'Basic blocks',
          'Văn bản thông thường.',
          ['p', 'text', 'chữ', 'đoạn văn'],
          <span className="font-semibold text-sm">T</span>,
          () => insert({ type: 'paragraph' }),
          'paragraph'
        ),
        item(
          'Heading 1',
          'Basic blocks',
          'Tiêu đề chính cấp 1.',
          ['h1', 'tiêu đề 1'],
          <Heading1 size={18} />,
          () => insert({ type: 'heading', props: { level: 1 } }),
          'heading',
          '#'
        ),
        item(
          'Heading 2',
          'Basic blocks',
          'Tiêu đề mục cấp 2.',
          ['h2', 'tiêu đề 2'],
          <Heading2 size={18} />,
          () => insert({ type: 'heading', props: { level: 2 } }),
          'heading_2',
          '##'
        ),
        item(
          'Heading 3',
          'Basic blocks',
          'Tiêu đề phụ cấp 3.',
          ['h3', 'tiêu đề 3'],
          <Heading3 size={18} />,
          () => insert({ type: 'heading', props: { level: 3 } }),
          'heading_3',
          '###'
        ),
        item(
          'Bullet List',
          'Basic blocks',
          'Danh sách có dấu chấm đầu dòng.',
          ['ul', 'bullet', 'danh sách'],
          <List size={18} />,
          () => insert({ type: 'bulletListItem' }),
          'bullet_list',
          '-'
        ),
        item(
          'Numbered List',
          'Basic blocks',
          'Danh sách đánh số thứ tự.',
          ['ol', 'số', 'danh sách số'],
          <ListOrdered size={18} />,
          () => insert({ type: 'numberedListItem' }),
          'numbered_list',
          '1.'
        ),
        item(
          'Check List',
          'Basic blocks',
          'Danh sách công việc có ô chọn hoàn thành.',
          ['todo', 'task', 'checklist'],
          <span className="text-sm">☑</span>,
          () => insert({ type: 'checkListItem' }),
          'check_list',
          '[]'
        ),
        item(
          'Quote',
          'Basic blocks',
          'Khối trích dẫn nổi bật.',
          ['blockquote', 'trích dẫn'],
          <Quote size={18} />,
          () => insert({ type: 'quote' }),
          'quote',
          '>'
        ),
        item(
          'Divider',
          'Basic blocks',
          'Đường kẻ ngang phân cách các phần.',
          ['hr', 'line', 'phân cách'],
          <Minus size={18} />,
          () => insert({ type: 'divider' }),
          'divider',
          '---'
        ),
        item(
          'Code Block',
          'Basic blocks',
          'Khối mã nguồn lập trình.',
          ['code', 'mã', 'lập trình'],
          <FileCode size={18} />,
          () => insert({ type: 'codeBlock' }),
          'code_block',
          '```'
        ),
        item(
          'Table',
          'Basic blocks',
          'Chèn bảng dữ liệu hàng cột.',
          ['table', 'bảng'],
          <TableIcon size={18} />,
          () => insert({ type: 'table' }),
          'table'
        ),
      ]

      if (!q) return allItems
      return allItems.filter((i) =>
        [i.title, ...(i.aliases || [])].some((alias) => alias.toLowerCase().includes(q))
      )
    },
    [editor, onAskAi]
  )

  // Thanh công cụ nổi khi bôi đen văn bản (Floating Formatting Toolbar)
  const CustomFloatingToolbar = () => {
    const activeStyles = useActiveStyles(editor)
    const [panel, setPanel] = useState<'link' | 'ai' | 'color' | null>(null)
    const [linkUrl, setLinkUrl] = useState('')
    const [linkError, setLinkError] = useState('')
    const [aiBusy, setAiBusy] = useState(false)

    const selectedText = editor.getSelectedText()
    if (!selectedText.trim()) return null

    const keep = (e: React.MouseEvent) => e.preventDefault()
    const color = activeStyles.textColor || 'default'

    const handleAiAction = async (mode: 'rewrite' | 'shorten' | 'expand' | 'translate', instruction?: string) => {
      setPanel(null)
      const text = editor.getSelectedText()
      if (!text.trim()) return
      setAiBusy(true)
      toast.info('N7AI đang xử lý đoạn văn bản…')
      try {
        const res = await ask.mutateAsync({
          selection: text,
          mode: mode === 'translate' ? 'none' : mode,
          instruction: mode === 'translate' ? 'Dịch đoạn văn này sang tiếng Việt tự nhiên và chuẩn xác.' : instruction,
        })
        if (res?.text) {
          // Thay thế đoạn bôi đen bằng kết quả
          editor.insertInlineContent([{ type: 'text', text: res.text, styles: {} }])
          toast.success('Đã cập nhật xong đoạn văn!')
        }
      } catch (err: any) {
        toast.error(err.message || 'Có lỗi xảy ra khi xử lý với AI.')
      } finally {
        setAiBusy(false)
      }
    }

    return (
      <div
        className="dt-note-toolbar"
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest('input')) e.preventDefault()
        }}
      >
        <button
          className={`dt-note-toolbar-ai ${panel === 'ai' ? 'is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={panel === 'ai'}
          onMouseDown={keep}
          disabled={aiBusy}
          onClick={() => setPanel(panel === 'ai' ? null : 'ai')}
        >
          <Sparkles size={14} className="text-primary" />
          <span>Ask N7AI</span>
          <ChevronDown size={12} className="opacity-60" />
        </button>

        <span className="dt-note-toolbar-sep" aria-hidden />

        {(
          [
            ['bold', Bold, 'In đậm (Ctrl+B)'],
            ['italic', Italic, 'In nghiêng (Ctrl+I)'],
            ['underline', Underline, 'Gạch chân (Ctrl+U)'],
            ['strike', Strikethrough, 'Gạch ngang'],
            ['code', Code, 'Mã nội dòng'],
          ] as const
        ).map(([style, Icon, label]) => (
          <button
            key={style}
            title={label}
            aria-label={label}
            aria-pressed={!!activeStyles[style]}
            onMouseDown={keep}
            onClick={() => editor.toggleStyles({ [style]: true })}
          >
            <Icon size={15} />
          </button>
        ))}

        <button
          title="Chèn liên kết"
          aria-label="Liên kết"
          aria-expanded={panel === 'link'}
          onMouseDown={keep}
          onClick={() => setPanel(panel === 'link' ? null : 'link')}
        >
          <LinkIcon size={15} />
        </button>

        <button
          title="Màu chữ"
          aria-label="Màu chữ"
          aria-haspopup="menu"
          aria-expanded={panel === 'color'}
          onMouseDown={keep}
          onClick={() => setPanel(panel === 'color' ? null : 'color')}
        >
          <span className="dt-note-color-glyph" data-color={color}>
            A
          </span>
          <ChevronDown size={11} className="opacity-60" />
        </button>

        {/* Panel AI Actions */}
        {panel === 'ai' && (
          <div className="dt-note-toolbar-panel" role="menu">
            <button
              role="menuitem"
              onMouseDown={keep}
              onClick={() => handleAiAction('rewrite')}
            >
              <PenLine size={14} />
              Viết lại mượt mà hơn
            </button>
            <button
              role="menuitem"
              onMouseDown={keep}
              onClick={() => handleAiAction('shorten')}
            >
              <Minimize2 size={14} />
              Rút gọn súc tích
            </button>
            <button
              role="menuitem"
              onMouseDown={keep}
              onClick={() => handleAiAction('expand')}
            >
              <Maximize2 size={14} />
              Mở rộng chi tiết
            </button>
            <button
              role="menuitem"
              onMouseDown={keep}
              onClick={() => handleAiAction('translate')}
            >
              <Languages size={14} />
              Dịch thuật
            </button>
            <div className="dt-note-toolbar-divider" />
            <button
              role="menuitem"
              onMouseDown={keep}
              onClick={() => {
                setPanel(null)
                onAskAi?.('', editor.getSelectedText())
              }}
            >
              <Sparkles size={14} />
              Hỏi N7AI về đoạn này…
            </button>
          </div>
        )}

        {/* Panel Color Picker */}
        {panel === 'color' && (
          <div className="dt-note-toolbar-panel is-colors" role="menu">
            {[
              ['default', 'Mặc định'],
              ['gray', 'Xám'],
              ['red', 'Đỏ'],
              ['orange', 'Cam'],
              ['yellow', 'Vàng'],
              ['green', 'Xanh lá'],
              ['blue', 'Xanh dương'],
              ['purple', 'Tím'],
            ].map(([c, name]) => (
              <button
                key={c}
                role="menuitemradio"
                aria-checked={color === c}
                onMouseDown={keep}
                onClick={() => {
                  setPanel(null)
                  if (c === 'default') editor.removeStyles({ textColor: color })
                  else editor.addStyles({ textColor: c })
                }}
              >
                <span className="dt-note-color-glyph" data-color={c}>
                  A
                </span>
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Panel Link Form */}
        {panel === 'link' && (
          <form
            className="dt-note-link-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(linkUrl.trim())) {
                setLinkError('Vui lòng nhập đường dẫn hợp lệ')
                return
              }
              editor.createLink(linkUrl.trim())
              setPanel(null)
              editor.focus()
            }}
          >
            <input
              autoFocus
              aria-label="URL liên kết"
              placeholder="Dán đường dẫn link…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setPanel(null)
                  editor.focus()
                }
              }}
            />
            <button type="submit">Áp dụng</button>
            {linkError && <p role="alert">{linkError}</p>}
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="dt-note-editor w-full">
      <BlockNoteViewRaw
        editor={editor}
        formattingToolbar={false}
        linkToolbar={false}
        slashMenu={false}
        sideMenu={false}
        filePanel={false}
        tableHandles={false}
        emojiPicker={false}
        comments={false}
        onChange={handleDocChange}
      >
        <FormattingToolbarController formattingToolbar={CustomFloatingToolbar} />
        {['/', '、'].map((trigger) => (
          <SuggestionMenuController
            key={trigger}
            triggerCharacter={trigger}
            shouldOpen={(tr) => {
              const parent = tr.selection.$from.parent
              return (
                !parent.type.spec.code &&
                !parent.type.isInGroup('tableContent') &&
                (trigger !== '、' || parent.textContent.length === 0)
              )
            }}
            getItems={getSlashMenuItems}
            suggestionMenuComponent={NoteInsertMenu}
          />
        ))}
      </BlockNoteViewRaw>
    </div>
  )
}

export default BlockNoteEditorComponent
