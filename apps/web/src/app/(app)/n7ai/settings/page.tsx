import { N7AiMenu } from '@/components/settings/n7ai/n7ai-menu'
import { N7AiPageHeader } from '@/components/n7ai/n7ai-page-header'

// /n7ai/settings: danh sách mục cài đặt N7AI
export default function N7AiSettingsPage() {
  return (
    <>
      <N7AiPageHeader title="Cài đặt N7AI" description="Kỹ năng, tác vụ tự động, kết nối, bộ nhớ, dữ liệu" />
      <div className="mx-2 rounded-xl bg-card pt-3 sm:mx-0">
        <N7AiMenu />
      </div>
    </>
  )
}
