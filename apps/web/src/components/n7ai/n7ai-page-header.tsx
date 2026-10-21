'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useN7AiNav } from './n7ai-nav'

// Đầu trang con của /n7ai (thư viện, cài đặt): ☰ mở lịch sử trên mobile, hoặc quay lại trang cha
export function N7AiPageHeader({ title, description, backHref, actions }: { title: string; description?: string; backHref?: string; actions?: React.ReactNode }) {
  const { openNav } = useN7AiNav()
  return (
    <div className="sticky top-0 z-30 flex items-start gap-2 bg-surface/90 px-2 pt-3 pb-2 backdrop-blur-md sm:px-3">
      {backHref ? (
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
          <Link href={backHref} aria-label="Quay lại">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full md:hidden" onClick={openNav} aria-label="Lịch sử N7AI">
          <Menu className="h-4 w-4" />
        </Button>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <h1 className="text-lg font-bold leading-tight">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0 pt-0.5">{actions}</div>}
    </div>
  )
}
