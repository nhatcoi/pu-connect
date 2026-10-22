import React, { useState } from 'react'
import { Bot, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { NewsCrawlerConfig, NewsOverview } from '@pu/schemas'
import { Button, Card, CardHeader, Field, Input, Select } from '@/components/ui'
import { Checkbox } from '@/components/ui/data'
import { useUpdateNewsConfig } from './use-news'

export function NewsConfigTab({ data }: { data: NewsOverview }) {
  const [config, setConfig] = useState<NewsCrawlerConfig>(data.config)
  const update = useUpdateNewsConfig()

  const handleSave = () => {
    update.mutate(
      {
        autoPost: config.autoPost,
        telegramEnabled: config.telegramEnabled,
        telegramBotToken: config.telegramBotToken?.trim() || null,
        telegramChatId: config.telegramChatId?.trim() || null,
        defaultBot: config.defaultBot,
        aiModel: config.aiModel
      },
      {
        onSuccess: () => toast.success('Đã lưu cấu hình thu thập tin!')
      }
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Cấu hình vận hành Bot & Đăng bài */}
      <Card>
        <CardHeader title="Chế độ đăng bài" />
        <div className="space-y-4 p-4 pt-0">
          <Field label="Bot chịu trách nhiệm đăng bài">
            <Select
              value={config.defaultBot}
              onChange={(e) => setConfig({ ...config, defaultBot: e.target.value })}
            >
              {data.availableBots.map((b) => (
                <option key={b.username} value={b.username}>
                  {b.displayName} (@{b.username})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Model AI tóm tắt">
            <Input
              value={config.aiModel}
              onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
              placeholder="n7ai-per"
            />
          </Field>

          <div className="pt-2">
            <label className="flex items-start gap-3 rounded-xl border border-border p-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
              <Checkbox
                checked={config.autoPost}
                onChange={(checked) => setConfig({ ...config, autoPost: checked })}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Chế độ Tự động hoàn toàn (Full Auto)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Khi bật, tin tức sau khi cào và AI tóm tắt xong sẽ tự động được đăng ngay lên PUC dưới tên @{config.defaultBot} mà không cần Admin duyệt tay.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" loading={update.isPending} onClick={handleSave}>
              <Save className="size-4" /> Lưu cấu hình
            </Button>
          </div>
        </div>
      </Card>

      {/* Cấu hình Telegram Monitor */}
      <Card>
        <CardHeader title="Kênh Telegram Monitor" />
        <div className="space-y-4 p-4 pt-0">
          <label className="flex items-start gap-3 rounded-xl border border-border p-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <Checkbox
              checked={config.telegramEnabled}
              onChange={(checked) => setConfig({ ...config, telegramEnabled: checked })}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Gửi thông báo bản tin mới vào Telegram
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bắn trực tiếp bản tóm tắt bài viết mới vào nhóm hoặc kênh Telegram để Admin duyệt nhanh.
              </p>
            </div>
          </label>

          {config.telegramEnabled && (
            <div className="space-y-3 pt-1">
              <Field label="Telegram Bot Token">
                <Input
                  type="password"
                  value={config.telegramBotToken ?? ''}
                  onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="font-mono text-xs"
                />
              </Field>

              <Field label="Telegram Chat ID">
                <Input
                  value={config.telegramChatId ?? ''}
                  onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })}
                  placeholder="-1001234567890 hoặc @channel_name"
                  className="font-mono text-xs"
                />
              </Field>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="primary" loading={update.isPending} onClick={handleSave}>
              <Save className="size-4" /> Lưu cấu hình
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
