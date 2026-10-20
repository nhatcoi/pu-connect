import React from 'react'
import { cn } from '@/lib/utils'

// Logo chính thức của connector Google (public/brand/connectors) / Official Google connector logos (Drive, Calendar, Gmail)
const ICONS: Partial<Record<string, string>> = {
  pu_connector: '/brand/pu-mark.svg',
  google_drive: '/brand/connectors/google-drive.svg',
  google_calendar: '/brand/connectors/google-calendar.svg',
  google_gmail: '/brand/connectors/gmail.svg',
  google_forms: '/brand/connectors/google-forms.svg',
  google_sheets: '/brand/connectors/google-sheets.svg',
  google_tasks: '/brand/connectors/google-tasks.svg',
  drive: '/brand/connectors/google-drive.svg',
  calendar: '/brand/connectors/google-calendar.svg',
  gmail: '/brand/connectors/gmail.svg',
  forms: '/brand/connectors/google-forms.svg',
  sheets: '/brand/connectors/google-sheets.svg',
  tasks: '/brand/connectors/google-tasks.svg',
  semantic_scholar: '/brand/connectors/semantic-scholar.svg',
  paper: '/brand/connectors/semantic-scholar.svg'
}

// id: AiConnectorId (google_drive) hoặc loại nguồn trích dẫn (drive, calendar); không có logo ⇒ null
export function ConnectorIcon({ id, className }: { id: string; className?: string }) {
  const src = ICONS[id]
  if (!src) return null
  // eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh, không cần tối ưu ảnh
  return <img src={src} alt="" aria-hidden className={cn('h-4 w-4 shrink-0 object-contain', className)} />
}
