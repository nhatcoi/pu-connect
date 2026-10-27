'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Megaphone, X } from 'lucide-react'
import type { AdminAnnouncementBanner } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'

const DISMISS_KEY = 'pu:dismissed-announcements'

const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')
  } catch {
    return []
  }
}

// Banner thông báo hệ thống do admin đặt; người dùng tắt được từng banner (nhớ theo trình duyệt)
export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<string[]>([])
  useEffect(() => setDismissed(readDismissed()), [])

  const { data } = useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => apiClient<{ data: AdminAnnouncementBanner[] }>('/announcements/active').then((r) => r.data),
    staleTime: 5 * 60_000
  })

  const banner = data?.find((b) => !dismissed.includes(b.id))
  if (!banner) return null

  const close = () => {
    const next = [...dismissed, banner.id].slice(-50)
    setDismissed(next)
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    } catch {
      /* chế độ riêng tư: chỉ tắt trong phiên */
    }
  }

  const body = (
    <>
      <strong>{banner.title}</strong> {banner.message}
    </>
  )

  return (
    <div role="status" className="flex items-start gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2 text-sm text-foreground">
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        {banner.link ? (
          <Link href={banner.link} className="hover:underline">
            {body}
          </Link>
        ) : (
          body
        )}
      </p>
      <button type="button" onClick={close} aria-label="Đóng thông báo" className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
