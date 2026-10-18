import React from 'react'
import { cn } from '@/lib/utils'

// Logo chính thức của connector Google (public/brand/connectors) / Official Google connector logos (Drive, Calendar, Gmail)
const ICONS: Partial<Record<string, string>> = {
  google_drive: '/brand/connectors/google-drive.svg',
  google_calendar: '/brand/connectors/google-calendar.svg',
  google_gmail: '/brand/connectors/gmail.svg',
  drive: '/brand/connectors/google-drive.svg',
  calendar: '/brand/connectors/google-calendar.svg',
  gmail: '/brand/connectors/gmail.svg'
}

// id: AiConnectorId (google_drive) hoặc loại nguồn trích dẫn (drive, calendar); không có logo ⇒ null
export function ConnectorIcon({ id, className }: { id: string; className?: string }) {
  const src = ICONS[id]
  if (!src) return null
  // eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh, không cần tối ưu ảnh
  return <img src={src} alt="" aria-hidden className={cn('h-4 w-4 shrink-0 object-contain', className)} />
}
