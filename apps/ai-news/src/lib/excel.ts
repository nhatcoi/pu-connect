import writeXlsxFile from 'write-excel-file/browser'

export interface ArticleItem {
  id: string
  title: string
  originalTitle?: string
  summary: string
  impact?: string
  category?: string
  sourceName: string
  link: string
  pubDate?: string
  imageUrl?: string | null
}

export async function exportToExcel(articles: ArticleItem[]) {
  const head = [
    { value: 'STT', fontWeight: 'bold' as const },
    { value: 'Tiêu đề tiếng Việt', fontWeight: 'bold' as const },
    { value: 'Tóm tắt nội dung', fontWeight: 'bold' as const },
    { value: 'Tác động chính', fontWeight: 'bold' as const },
    { value: 'Lĩnh vực', fontWeight: 'bold' as const },
    { value: 'Nguồn tin', fontWeight: 'bold' as const },
    { value: 'Link bài gốc', fontWeight: 'bold' as const },
    { value: 'Link ảnh', fontWeight: 'bold' as const },
    { value: 'Thời gian', fontWeight: 'bold' as const }
  ]

  const rows = articles.map((a, idx) => [
    { type: Number, value: idx + 1 },
    { type: String, value: a.title },
    { type: String, value: a.summary },
    { type: String, value: a.impact || '' },
    { type: String, value: a.category || '' },
    { type: String, value: a.sourceName },
    { type: String, value: a.link },
    { type: String, value: a.imageUrl || '' },
    { type: String, value: a.pubDate || '' }
  ])

  const blob = await (writeXlsxFile as any)([head, ...rows]).toBlob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `AI_News_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportToJson(articles: ArticleItem[]) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(articles, null, 2))
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute('href', dataStr)
  downloadAnchor.setAttribute('download', `AI_News_${new Date().toISOString().slice(0, 10)}.json`)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  downloadAnchor.remove()
}
