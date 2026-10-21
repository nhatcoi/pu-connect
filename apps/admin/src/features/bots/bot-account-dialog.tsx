import React, { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { BOT_ROLES, type AdminBotAccount, type AdminBotAccountInput, type BotRole } from '@pu/schemas'
import { Badge, Button, Dialog, Field, Input, Select, Textarea } from '@/components/ui'

const ROLE_LABEL: Record<BotRole, string> = { student: 'Sinh viên', lecturer: 'Giảng viên', ta: 'Trợ giảng' }
const EMPTY: AdminBotAccountInput = { username: '', displayName: '', role: 'student', faculty: 'FIT', bio: '', tone: '', major: '', soul: '' }

interface PersonaPreset {
  label: string
  icon: string
  data: Partial<AdminBotAccountInput>
}

const PRESETS: PersonaPreset[] = [
  {
    label: 'Sinh viên IT',
    icon: '💻',
    data: {
      displayName: 'Minh Anh IT',
      role: 'student',
      faculty: 'FIT',
      major: 'Công nghệ thông tin',
      bio: 'Sinh viên năm 3 CNTT Phenikaa, thích lập trình, cơ sở dữ liệu và chia sẻ tài liệu học tập.',
      soul: 'Sinh viên năm 3 năng động, đam mê công nghệ. Hay chia sẻ kinh nghiệm học tập, mẹo giải thuật, đề thi các môn CNTT. Văn phong trẻ trung, tích cực, ham học hỏi.',
      tone: 'thân thiện, năng động, hài hước nhẹ'
    }
  },
  {
    label: 'Giảng viên Cố vấn',
    icon: '📚',
    data: {
      displayName: 'ThS. Hoàng Nam',
      role: 'lecturer',
      faculty: 'FIT',
      major: 'Kỹ thuật phần mềm',
      bio: 'Giảng viên khoa CNTT, phụ trách môn Cơ sở dữ liệu và Kiến trúc phần mềm.',
      soul: 'Giảng viên tận tâm, phong cách chuẩn mực học thuật. Hay chia sẻ tài liệu hữu ích, định hướng nghề nghiệp và giải đáp khúc mắc cho sinh viên một cách súc tích.',
      tone: 'chuẩn mực, ân cần, khích lệ sinh viên'
    }
  },
  {
    label: 'Trợ giảng TA',
    icon: '🎯',
    data: {
      displayName: 'Đức Huy TA',
      role: 'ta',
      faculty: 'FIT',
      major: 'Trí tuệ nhân tạo',
      bio: 'Trợ giảng môn Toán rời rạc & Cấu trúc dữ liệu, hỗ trợ giải đáp bài tập.',
      soul: 'Trợ giảng nhiệt tình, kiên nhẫn. Hay đưa ra gợi ý giải bài tập từng bước, giải thích khái niệm trừu tượng thành ví dụ thực tế dễ hiểu.',
      tone: 'nhiệt tình, kiên nhẫn, rõ ràng'
    }
  },
  {
    label: 'Sinh viên Năng động',
    icon: '☕',
    data: {
      displayName: 'Hương Giang',
      role: 'student',
      faculty: 'Kinh tế & Kinh doanh',
      major: 'Marketing',
      bio: 'Sinh viên Marketing Gen Z, đam mê sự kiện, CLB và kết nối bạn bè tại Phenikaa.',
      soul: 'Sinh viên hòa đồng, thích chia sẻ về đời sống học đường, kinh nghiệm tham gia CLB, địa điểm học tập chill và góc nhìn sáng tạo.',
      tone: 'trẻ trung, tươi sáng, truyền cảm hứng'
    }
  }
]

// Khởi tạo hoặc sửa hồ sơ tài khoản bot (mặc định kích hoạt đầy đủ quyền, mật khẩu do hệ thống cấp)
export function BotAccountDialog({
  open,
  bot,
  saving,
  onClose,
  onSave
}: {
  open: boolean
  bot: AdminBotAccount | null
  saving: boolean
  onClose: () => void
  onSave: (v: AdminBotAccountInput) => void
}) {
  const [draft, setDraft] = useState<AdminBotAccountInput>(EMPTY)

  useEffect(() => {
    if (open) {
      setDraft(
        bot
          ? {
              username: bot.username,
              displayName: bot.displayName,
              role: bot.role,
              faculty: bot.faculty ?? '',
              bio: bot.bio,
              tone: bot.tone,
              major: bot.major,
              soul: bot.soul
            }
          : EMPTY
      )
    }
  }, [open, bot])

  if (!open) return null
  const set = <K extends keyof AdminBotAccountInput>(k: K, v: AdminBotAccountInput[K]) => setDraft({ ...draft, [k]: v })
  const valid = draft.displayName.trim().length >= 2 && draft.faculty.trim().length > 0 && (!!bot || /^[a-z0-9._]{3,30}$/.test(draft.username))

  const applyPreset = (preset: PersonaPreset) => {
    const randomSuffix = Math.floor(10 + Math.random() * 90)
    const suggestedUsername = !bot && !draft.username
      ? (preset.data.displayName || 'bot')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '') + randomSuffix
      : draft.username

    setDraft((prev) => ({
      ...prev,
      ...preset.data,
      username: suggestedUsername
    }))
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={bot ? `Sửa hồ sơ @${bot.username}` : 'Khởi tạo Bot mới'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" loading={saving} disabled={!valid} onClick={() => onSave(draft)}>
            {bot ? 'Lưu thay đổi' : 'Khởi tạo Bot'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Mẫu persona gợi ý nhanh khi tạo mới */}
        {!bot && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              Mẫu Persona gợi ý
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!bot && (
            <Field label="Username">
              <Input
                value={draft.username}
                onChange={(e) => set('username', e.target.value.toLowerCase())}
                maxLength={30}
                placeholder="vd: minhanh_it"
                className="font-mono"
              />
            </Field>
          )}

          <Field label="Tên hiển thị">
            <Input value={draft.displayName} onChange={(e) => set('displayName', e.target.value)} maxLength={60} placeholder="vd: Minh Anh IT" />
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

          <Field label="Chuyên ngành">
            <Input value={draft.major ?? ''} onChange={(e) => set('major', e.target.value)} maxLength={80} placeholder="Công nghệ thông tin" />
          </Field>

          <Field label="Giọng văn (Tone)">
            <Input value={draft.tone ?? ''} onChange={(e) => set('tone', e.target.value)} maxLength={300} placeholder="thân thiện, năng động, chuẩn mực" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Giới thiệu (Bio)">
              <Textarea rows={2} value={draft.bio ?? ''} onChange={(e) => set('bio', e.target.value)} maxLength={300} placeholder="Giới thiệu ngắn..." />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Linh hồn & Phong cách (Soul)">
              <Textarea
                rows={4}
                value={draft.soul ?? ''}
                onChange={(e) => set('soul', e.target.value)}
                maxLength={2000}
                placeholder="Tính cách, kiến thức, cách hành văn, xưng hô, chủ đề yêu thích..."
              />
            </Field>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
