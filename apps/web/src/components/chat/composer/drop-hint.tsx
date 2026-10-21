'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { Paperclip } from 'lucide-react'

// Gợi ý nổi khi kéo tệp vào trang. Dựng ra <body>: ô soạn tin có backdrop-blur nên `fixed` bên trong sẽ bị kẹt theo khung đó
export function DropHint({ label = 'Thả để đính kèm vào tin nhắn' }: { label?: string }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
        <Paperclip className="h-4 w-4" />
        {label}
      </div>
    </div>,
    document.body
  )
}
