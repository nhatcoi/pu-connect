import React, { useEffect, useState } from 'react'
import { BOT_ROLES, type AdminBotAccount, type AdminBotAccountInput, type BotRole } from '@pu/schemas'
import { Button, Dialog, Field, Input, Select, Textarea } from '@/components/ui'

const ROLE_LABEL: Record<BotRole, string> = { student: 'Sinh viên', lecturer: 'Giảng viên', ta: 'Trợ giảng' }
const EMPTY: AdminBotAccountInput = { username: '', displayName: '', role: 'student', faculty: 'FIT', bio: '', tone: '', major: '' }

// Tạo hoặc sửa hồ sơ tài khoản bot (bot=null & open ⇒ tạo mới). Mật khẩu do hệ thống cấp.
export function BotAccountDialog({ open, bot, saving, onClose, onSave }: { open: boolean; bot: AdminBotAccount | null; saving: boolean; onClose: () => void; onSave: (v: AdminBotAccountInput) => void }) {
  const [draft, setDraft] = useState<AdminBotAccountInput>(EMPTY)
  useEffect(() => {
    if (open) setDraft(bot ? { username: bot.username, displayName: bot.displayName, role: bot.role, faculty: bot.faculty ?? '', bio: bot.bio, tone: bot.tone, major: bot.major } : EMPTY)
  }, [open, bot])
  if (!open) return null
  const set = <K extends keyof AdminBotAccountInput>(k: K, v: AdminBotAccountInput[K]) => setDraft({ ...draft, [k]: v })
  const valid = draft.displayName.trim().length >= 2 && draft.faculty.trim().length > 0 && (!!bot || /^[a-z0-9._]{3,30}$/.test(draft.username))

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={bot ? `Sửa hồ sơ @${bot.username}` : 'Tạo bot mới'}
      description={bot ? undefined : 'Bot mới mặc định không có quyền nào; cấp quyền ở nút Cấu hình.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" loading={saving} disabled={!valid} onClick={() => onSave(draft)}>
            {bot ? 'Lưu' : 'Tạo bot'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!bot && (
          <Field label="Username" hint="a–z, 0–9, . _ (3–30)">
            <Input value={draft.username} onChange={(e) => set('username', e.target.value.toLowerCase())} maxLength={30} placeholder="vd: minhanhbot" />
          </Field>
        )}
        <Field label="Tên hiển thị">
          <Input value={draft.displayName} onChange={(e) => set('displayName', e.target.value)} maxLength={60} />
        </Field>
        <Field label="Vai trò">
          <Select value={draft.role} onChange={(e) => set('role', e.target.value as BotRole)}>
            {BOT_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Khoa">
          <Input value={draft.faculty} onChange={(e) => set('faculty', e.target.value)} maxLength={50} placeholder="FIT" />
        </Field>
        <Field label="Ngành">
          <Input value={draft.major ?? ''} onChange={(e) => set('major', e.target.value)} maxLength={80} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Giới thiệu (bio)">
            <Textarea rows={2} value={draft.bio ?? ''} onChange={(e) => set('bio', e.target.value)} maxLength={300} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Giọng văn" hint="AI dùng khi viết bài/bình luận">
            <Textarea rows={2} value={draft.tone ?? ''} onChange={(e) => set('tone', e.target.value)} maxLength={300} placeholder="VD: thân thiện, gọn, hay chia sẻ mẹo học tập" />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}
