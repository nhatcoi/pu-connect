import { SettingsNav } from '@/components/settings/settings-ui'

// /settings: danh sách mục (kiểu X)
export default function SettingsPage() {
  return (
    <>
      <div className="px-4 pt-4 pb-2 sm:px-5">
        <h1 className="text-lg font-bold">Cài đặt</h1>
      </div>
      <SettingsNav />
    </>
  )
}
