'use client'

import React from 'react'
import { ArrowUpRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { chatApi } from '@/hooks/chat'
import { ConnectorIcon } from './connector-icon'

export function PuConnectorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <ConnectorIcon id="pu_connector" className="mb-2 h-10 w-10" />
          <DialogTitle>Kết nối PU Connect</DialogTitle>
          <DialogDescription>Lịch học, điểm và deadline từ tài khoản trường.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li>
            <span className="font-medium">1. Cài extension</span>
            <p className="text-xs text-muted-foreground">Dùng Chrome hoặc Edge trên máy tính.</p>
          </li>
          <li>
            <span className="font-medium">2. Đăng nhập tài khoản trường</span>
            <p className="text-xs text-muted-foreground">Mở Canvas hoặc QLĐT và đăng nhập.</p>
          </li>
          <li>
            <span className="font-medium">3. Cho phép kết nối trên PKA</span>
            <p className="text-xs text-muted-foreground">N7AI chỉ được đọc dữ liệu học tập.</p>
          </li>
        </ol>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" className="min-h-10 rounded-full" asChild>
            <a href="https://pka.vnhat.dev/extension" target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Cài extension
            </a>
          </Button>
          <Button className="min-h-10 rounded-full" onClick={() => window.location.assign(chatApi.connectorConnectUrl('pu_connector'))}>
            Tiếp tục
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
