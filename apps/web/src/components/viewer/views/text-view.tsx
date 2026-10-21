'use client'

import React, { useMemo } from 'react'
import hljs from 'highlight.js/lib/common'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { fileExtension } from '../file-kind'
import { useFileText } from '../use-file-bytes'
import { DataGrid } from './data-grid'
import { detectDelimiter, parseDelimited } from './csv'
import { Stage, ViewerError, ViewerLoading } from './viewer-parts'

const LANGUAGES: Record<string, string> = {
  py: 'python',
  ipynb: 'json',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  java: 'java',
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  sql: 'sql',
  sh: 'bash',
  r: 'r',
  kt: 'kotlin',
  swift: 'swift',
  json: 'json',
  xml: 'xml',
  html: 'xml',
  htm: 'xml',
  css: 'css',
  yml: 'yaml',
  yaml: 'yaml'
}
const MAX_HIGHLIGHT = 200_000 // tệp lớn hơn ⇒ hiển thị thô cho nhanh

function TruncatedNote({ show }: { show: boolean }) {
  return show ? <p className="mt-3 text-center text-xs text-muted-foreground">Tệp lớn, chỉ hiển thị phần đầu. Tải về để xem đầy đủ.</p> : null
}

// Trang giấy chứa văn bản / ghi chú
const Paper = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto my-4 max-w-3xl rounded-xl bg-card p-5 pb-8 shadow-sm ring-1 ring-border sm:p-7">{children}</div>
)

export function MarkdownView({ url }: { url: string }) {
  const { data, isError } = useFileText(url)
  if (isError) return <ViewerError />
  if (!data) return <ViewerLoading />
  return (
    <Stage>
      <Paper>
        <MarkdownPreview content={data.text} />
        <TruncatedNote show={data.truncated} />
      </Paper>
    </Stage>
  )
}

export function CodeView({ url, name }: { url: string; name: string }) {
  const { data, isError } = useFileText(url)
  const html = useMemo(() => {
    if (!data) return ''
    const language = LANGUAGES[fileExtension(name)]
    if (!language || data.text.length > MAX_HIGHLIGHT) return ''
    return hljs.highlight(data.text, { language, ignoreIllegals: true }).value
  }, [data, name])
  if (isError) return <ViewerError />
  if (!data) return <ViewerLoading />
  return (
    <Stage>
      <div className="mx-auto my-4 w-max min-w-[calc(100%-2rem)] max-w-none rounded-xl bg-[#0d1117] p-4 pb-6 text-[#c9d1d9] shadow-sm ring-1 ring-border">
        {html ? (
          <pre className="hljs bg-transparent! p-0! font-mono text-[13px] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">{data.text}</pre>
        )}
        <TruncatedNote show={data.truncated} />
      </div>
    </Stage>
  )
}

export function CsvView({ url, name }: { url: string; name: string }) {
  const { data, isError } = useFileText(url)
  const rows = useMemo(() => (data ? parseDelimited(data.text, detectDelimiter(data.text, fileExtension(name))) : []), [data, name])
  if (isError) return <ViewerError />
  if (!data) return <ViewerLoading />
  return (
    <Stage>
      <DataGrid rows={rows} />
    </Stage>
  )
}
