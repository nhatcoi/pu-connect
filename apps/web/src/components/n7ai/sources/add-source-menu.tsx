'use client'

import React, { useRef, useState } from 'react'
import { ClipboardPaste, FolderOpen, Library, Link2, Loader2, Plus, Upload } from 'lucide-react'
import { SOURCE_ACCEPT } from '@/components/chat/composer/attachment-files'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DocumentPickerDialog } from './document-picker-dialog'
import { AddLinkDialog, AddTextDialog, LibraryPickerDialog } from './source-dialogs'
import type { SourceAdder } from './use-add-sources'

type Dialog = 'text' | 'link' | 'library' | 'kho' | null

// Nút "Thêm tài liệu": tải tệp lên · từ thư viện (chỉ trong cuộc trò chuyện) · dán văn bản · liên kết web / YouTube
export function AddSourceMenu({ adder, inThread, className }: { adder: SourceAdder; inThread: boolean; className?: string }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const busy = adder.uploading.length > 0 || adder.adding
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept={SOURCE_ACCEPT}
        onChange={(e) => {
          if (e.target.files) void adder.addFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" className={className ?? 'h-8 gap-1.5 rounded-full px-3 text-xs'}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Thêm tài liệu
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4" /> Tải tệp lên
          </DropdownMenuItem>
          {inThread && (
            <DropdownMenuItem onSelect={() => setDialog('library')}>
              <Library className="h-4 w-4" /> Từ thư viện
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog('kho')}>
            <FolderOpen className="h-4 w-4" /> Từ kho tài liệu
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog('text')}>
            <ClipboardPaste className="h-4 w-4" /> Dán văn bản
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('link')}>
            <Link2 className="h-4 w-4" /> Liên kết web · YouTube
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddTextDialog open={dialog === 'text'} onOpenChange={close} adder={adder} />
      <AddLinkDialog open={dialog === 'link'} onOpenChange={close} adder={adder} />
      {dialog === 'kho' && <DocumentPickerDialog open onOpenChange={close} adder={adder} />}
      {/* Chỉ dựng khi mở: hộp thoại này tải thư viện */}
      {inThread && dialog === 'library' && <LibraryPickerDialog open onOpenChange={close} adder={adder} />}
    </>
  )
}
