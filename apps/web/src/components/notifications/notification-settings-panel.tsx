'use client'

import React, { useEffect, useState } from 'react'
import { BellRing, Loader2, Moon, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  notificationsApi,
  type NotificationSettings,
  type NotificationSettingsPatch
} from '@/hooks/use-notifications'
import {
  disablePush,
  enablePush,
  getPushStatus,
  isIosNeedingInstall,
  sendTestPush,
  type PushStatus
} from '@/lib/push'
import { SettingsListSkeleton } from '@/components/skeletons/catalog-skeleton'

const TYPE_LABELS: Record<string, string> = {
  comment_reply: 'Trả lời bình luận của bạn',
  user_mention: 'Nhắc đến bạn (@)',
  accepted_solution: 'Được chọn làm lời giải',
  post_comment: 'Bình luận vào bài viết của bạn',
  post_like: 'Lượt thích bài viết',
  user_follow: 'Người theo dõi mới'
}

const PUSH_STATUS_TEXT: Record<PushStatus, string> = {
  enabled: 'Đang bật trên trình duyệt này',
  disabled: 'Nhận thông báo cả khi đã đóng tab',
  denied: 'Bạn đã chặn thông báo. Mở cài đặt trang (biểu tượng ổ khóa trên thanh địa chỉ) để cho phép lại.',
  unsupported: 'Trình duyệt này không hỗ trợ thông báo đẩy.',
  'server-disabled': 'Máy chủ chưa bật thông báo đẩy.'
}

export function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    notificationsApi.getSettings().then((r) => setSettings(r.data)).catch(() => undefined)
    getPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'))
  }, [])

  // Cập nhật lạc quan; lỗi ⇒ tải lại từ server
  const save = async (patch: NotificationSettingsPatch, optimistic: NotificationSettings) => {
    setSettings(optimistic)
    try {
      setSettings((await notificationsApi.updateSettings(patch)).data)
    } catch {
      toast.error('Không lưu được cài đặt')
      notificationsApi.getSettings().then((r) => setSettings(r.data)).catch(() => undefined)
    }
  }

  const togglePush = async () => {
    setBusy(true)
    try {
      if (pushStatus === 'enabled') {
        await disablePush()
        setPushStatus('disabled')
      } else {
        const status = await enablePush()
        setPushStatus(status)
        if (status === 'enabled') toast.success('Đã bật thông báo trên trình duyệt')
      }
    } catch {
      toast.error('Không bật được thông báo trên trình duyệt')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      const r = await sendTestPush()
      if (r.sent > 0) toast.success('Đã gửi thông báo thử')
      else toast.error('Chưa có trình duyệt nào nhận được — hãy bật lại thông báo')
    } catch (e: any) {
      toast.error(e?.message || 'Gửi thử thất bại')
    } finally {
      setBusy(false)
    }
  }

  if (!settings) {
    return <SettingsListSkeleton />
  }

  const pushOn = pushStatus === 'enabled'
  const iosHint = pushStatus === 'unsupported' && isIosNeedingInstall()

  return (
    <div className="space-y-4">
      {/* Thông báo đẩy trên trình duyệt (Web Push) */}
      <div className="flex items-start gap-3 rounded-xl bg-primary/[0.05] p-3">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Thông báo trên trình duyệt</p>
          <p className="text-xs text-muted-foreground">
            {iosHint
              ? 'Trên iPhone: bấm Chia sẻ → "Thêm vào Màn hình chính", mở PU Connector từ màn hình chính rồi bật tại đây.'
              : pushStatus
                ? PUSH_STATUS_TEXT[pushStatus]
                : 'Đang kiểm tra…'}
          </p>
        </div>
        {(pushStatus === 'enabled' || pushStatus === 'disabled') && (
          <div className="flex shrink-0 gap-1.5">
            {pushOn && (
              <Button size="sm" variant="ghost" onClick={test} disabled={busy} className="h-8 rounded-full px-3 text-xs">
                <Send className="mr-1 h-3.5 w-3.5" /> Gửi thử
              </Button>
            )}
            <Button
              size="sm"
              variant={pushOn ? 'outline' : 'default'}
              onClick={togglePush}
              disabled={busy}
              className="h-8 rounded-full px-3 text-xs"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : pushOn ? 'Tắt' : 'Bật'}
            </Button>
          </div>
        )}
      </div>

      {/* Ma trận loại × kênh */}
      <div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 gap-y-2.5 text-[13px]">
          <span className="text-xs font-semibold text-muted-foreground">Loại thông báo</span>
          <span className="w-14 text-center text-[11px] font-semibold text-muted-foreground">Trong app</span>
          <span className="w-14 text-center text-[11px] font-semibold text-muted-foreground">Trình duyệt</span>
          {/* Tin nhắn: trong app luôn có badge "Tin nhắn"; chỉ bật/tắt push (tắt riêng từng hội thoại trong chat) */}
          <span>Tin nhắn mới</span>
          <span className="w-14 text-center text-[11px] text-muted-foreground">Luôn bật</span>
          <span className="flex w-14 justify-center">
            <Switch
              checked={settings.push.chat_message !== false}
              disabled={!pushOn}
              aria-label="Tin nhắn mới — trình duyệt"
              onCheckedChange={(v) => save({ push: { chat_message: v } }, { ...settings, push: { ...settings.push, chat_message: v } })}
            />
          </span>
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const inApp = settings.inApp[type] !== false
            const push = inApp && settings.push[type] === true
            return (
              <React.Fragment key={type}>
                <span>{label}</span>
                <span className="flex w-14 justify-center">
                  <Switch
                    checked={inApp}
                    aria-label={`${label} — trong app`}
                    onCheckedChange={(v) =>
                      save({ inApp: { [type]: v } }, { ...settings, inApp: { ...settings.inApp, [type]: v } })
                    }
                  />
                </span>
                <span className="flex w-14 justify-center">
                  <Switch
                    checked={push}
                    disabled={!inApp || !pushOn}
                    aria-label={`${label} — trình duyệt`}
                    onCheckedChange={(v) =>
                      save({ push: { [type]: v } }, { ...settings, push: { ...settings.push, [type]: v } })
                    }
                  />
                </span>
              </React.Fragment>
            )
          })}
        </div>
        {!pushOn && (
          <p className="mt-2 text-[11px] text-muted-foreground">Bật thông báo trên trình duyệt để chọn cột “Trình duyệt”.</p>
        )}
      </div>

      {/* Giờ yên tĩnh (giờ Việt Nam) */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-[13px]">
        <Moon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Giờ yên tĩnh</span>
        <Switch
          checked={settings.quietHours.enabled}
          aria-label="Bật giờ yên tĩnh"
          onCheckedChange={(v) =>
            save({ quietHours: { enabled: v } }, { ...settings, quietHours: { ...settings.quietHours, enabled: v } })
          }
        />
        {settings.quietHours.enabled && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            từ
            <input
              type="time"
              value={settings.quietHours.start}
              onChange={(e) =>
                save(
                  { quietHours: { start: e.target.value } },
                  { ...settings, quietHours: { ...settings.quietHours, start: e.target.value } }
                )
              }
              className="rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground"
            />
            đến
            <input
              type="time"
              value={settings.quietHours.end}
              onChange={(e) =>
                save(
                  { quietHours: { end: e.target.value } },
                  { ...settings, quietHours: { ...settings.quietHours, end: e.target.value } }
                )
              }
              className="rounded-md border border-border bg-background px-1.5 py-0.5 text-foreground"
            />
          </span>
        )}
        <p className="w-full text-[11px] text-muted-foreground">
          Thông báo trình duyệt trong khung giờ này được hoãn tới sáng; thông báo trong app vẫn hiện bình thường.
        </p>
      </div>
    </div>
  )
}
