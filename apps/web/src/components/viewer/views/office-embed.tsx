'use client'

import React from 'react'

// Office Online chỉ đọc tệp qua URL công khai ⇒ dùng cho định dạng cũ (.doc .ppt .xls .odt …) mà trình xem trong app chưa đọc được
export function OfficeEmbed({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex h-full flex-col">
      <p className="shrink-0 bg-muted/60 px-3 py-1.5 text-center text-[11px] text-muted-foreground">Định dạng cũ, đang xem qua Office Online (Microsoft)</p>
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
        title={name}
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  )
}
