import React from 'react'
import { Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

// Logo chính thức của connector Google (public/brand/connectors) / Official Google connector logos
const ICONS: Partial<Record<string, string>> = {
  google_drive: '/brand/connectors/google-drive.svg',
  google_calendar: '/brand/connectors/google-calendar.svg',
  drive: '/brand/connectors/google-drive.svg',
  calendar: '/brand/connectors/google-calendar.svg'
}

// id: AiConnectorId (google_drive) hoặc loại nguồn trích dẫn (drive, calendar); không có logo ⇒ null
export function ConnectorIcon({ id, className }: { id: string; className?: string }) {
  if (id === 'google_gmail') return <Mail aria-hidden className={cn('h-4 w-4 shrink-0 text-primary', className)} />
  const src = ICONS[id]
  if (!src) return null
  // eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh, không cần tối ưu ảnh
  return <img src={src} alt="" aria-hidden className={cn('h-4 w-4 shrink-0 object-contain', className)} />
}
