'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PuMark } from '@/components/brand/pu-logo'
import { AuthForm } from '@/components/auth/auth-form'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-6 gap-5">
        <DialogHeader className="items-center text-center sm:text-center space-y-2">
          <PuMark className="h-10 w-10" />
          <DialogTitle className="text-lg font-semibold">Đăng nhập PU Connector</DialogTitle>
          <DialogDescription className="text-[13px]">Chia sẻ tài liệu, đặt câu hỏi và kết nối cùng cộng đồng Phenikaa.</DialogDescription>
        </DialogHeader>
        <AuthForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
