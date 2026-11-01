import { AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, type ParagraphChild } from 'docx'
import { Lexer, type Token, type Tokens } from 'marked'

type Style = { bold?: boolean; italics?: boolean; code?: boolean }

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]

function run(text: string, s: Style): TextRun {
  return new TextRun({ text, bold: s.bold, italics: s.italics, font: s.code ? 'Menlo' : undefined, ...(s.code ? { shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' } } : {}) })
}

// Inline: chữ đậm / nghiêng / mã / liên kết; khối tương tác (ảnh, HTML) ⇒ chữ tĩnh
function inline(tokens: Token[] | undefined, s: Style = {}): ParagraphChild[] {
  const out: ParagraphChild[] = []
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'strong':
        out.push(...inline((t as Tokens.Strong).tokens, { ...s, bold: true }))
        break
      case 'em':
        out.push(...inline((t as Tokens.Em).tokens, { ...s, italics: true }))
        break
      case 'codespan':
        out.push(run((t as Tokens.Codespan).text, { ...s, code: true }))
        break
      case 'del':
        out.push(...inline((t as Tokens.Del).tokens, s))
        break
      case 'br':
        out.push(new TextRun({ break: 1 }))
        break
      case 'link': {
        const l = t as Tokens.Link
        out.push(new ExternalHyperlink({ link: l.href, children: [new TextRun({ text: l.text || l.href, style: 'Hyperlink', color: '0563C1', underline: {} })] }))
        break
      }
      case 'image':
        out.push(run((t as Tokens.Image).text || (t as Tokens.Image).href, s))
        break
      case 'text': {
        const x = t as Tokens.Text
        if (x.tokens?.length) out.push(...inline(x.tokens, s))
        else out.push(run(x.text, s))
        break
      }
      default:
        out.push(run((t as { text?: string; raw: string }).text ?? t.raw, s))
    }
  }
  return out
}

function listItems(list: Tokens.List, level: number): Paragraph[] {
  const out: Paragraph[] = []
  list.items.forEach((item, idx) => {
    const lead: ParagraphChild[] = list.ordered ? [new TextRun({ text: `${Number(list.start || 1) + idx}. ` })] : []
    const inlineTokens: Token[] = []
    const nested: Token[] = []
    for (const t of item.tokens) (t.type === 'list' ? nested : inlineTokens).push(t)
    const text = inlineTokens.flatMap((t) => (t.type === 'text' || t.type === 'paragraph' ? inline((t as Tokens.Text).tokens ?? [t]) : [new TextRun({ text: t.raw.trim() })]))
    out.push(new Paragraph({ children: [...lead, ...text], ...(list.ordered ? { indent: { left: 360 * (level + 1) } } : { bullet: { level: Math.min(level, 8) } }) }))
    for (const n of nested) out.push(...listItems(n as Tokens.List, level + 1))
  })
  return out
}

function blocks(tokens: Token[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  for (const t of tokens) {
    switch (t.type) {
      case 'heading': {
        const h = t as Tokens.Heading
        out.push(new Paragraph({ heading: HEADINGS[Math.min(h.depth, 6) - 1], children: inline(h.tokens) }))
        break
      }
      case 'paragraph':
        out.push(new Paragraph({ children: inline((t as Tokens.Paragraph).tokens), spacing: { after: 120 } }))
        break
      case 'list':
        out.push(...listItems(t as Tokens.List, 0))
        break
      case 'blockquote':
        for (const p of blocks((t as Tokens.Blockquote).tokens)) {
          if (p instanceof Paragraph) out.push(p)
        }
        break
      case 'code':
        for (const line of (t as Tokens.Code).text.split('\n')) {
          out.push(new Paragraph({ children: [run(line || ' ', { code: true })], shading: { type: ShadingType.CLEAR, fill: 'F3F3F3' } }))
        }
        break
      case 'hr':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } } }))
        break
      case 'table': {
        const tb = t as Tokens.Table
        const cell = (c: Tokens.TableCell, header: boolean) =>
          new TableCell({ children: [new Paragraph({ children: inline(c.tokens, { bold: header }), alignment: AlignmentType.LEFT })] })
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: tb.header.map((c) => cell(c, true)) }), ...tb.rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) }))]
          })
        )
        break
      }
      case 'space':
        break
      default:
        if (t.raw.trim()) out.push(new Paragraph({ children: [new TextRun({ text: t.raw.trim() })] }))
    }
  }
  return out
}

// Markdown ⇒ .docx: giữ chữ và liên kết, khối tương tác thành chữ tĩnh
export async function noteToDocx(title: string, markdown: string): Promise<Buffer> {
  const body = blocks(new Lexer().lex(markdown))
  const children = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title || 'Ghi chú' })] }), ...body]
  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

export const noteFileName = (title: string, ext: string) => `${(title || 'ghi-chu').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 80) || 'ghi-chu'}.${ext}`
