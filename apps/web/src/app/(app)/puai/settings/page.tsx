import { PuaiMenu } from '@/components/settings/puai/puai-menu'
import { PuaiPageHeader } from '@/components/puai/puai-page-header'

// /puai/settings: danh sách mục cài đặt PU AI
export default function PuaiSettingsPage() {
  return (
    <>
      <PuaiPageHeader title="Cài đặt PU AI" description="Kỹ năng, tác vụ tự động, kết nối, bộ nhớ, dữ liệu" />
      <div className="mx-2 rounded-xl bg-card pt-3 sm:mx-0">
        <PuaiMenu />
      </div>
    </>
  )
}
