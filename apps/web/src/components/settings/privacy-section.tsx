'use client'

import React from 'react'
import type { PrivacySettings } from '@pu/schemas'
import { usePrivacySettings } from '@/hooks/use-settings'
import { SettingsGroup, SwitchRow } from './settings-ui'

// Quyền riêng tư: lưu ngay từng công tắc (không còn nút "Lưu cài đặt")
export function PrivacySection() {
  const { settings, update } = usePrivacySettings()
  const bind = (key: keyof PrivacySettings) => ({
    id: `privacy-${key}`,
    checked: settings[key],
    onCheckedChange: (v: boolean) => void update({ [key]: v })
  })

  return (
    <>
      <SettingsGroup label="Thông tin trên hồ sơ">
        <SwitchRow {...bind('showEmail')} label="Hiện email" description="Mọi người xem được địa chỉ email trên hồ sơ của bạn" />
        <SwitchRow {...bind('showStudentId')} label="Hiện mã sinh viên" description="Giúp bạn bè và giảng viên dễ nhận ra bạn" />
        <SwitchRow {...bind('showClass')} label="Hiện lớp sinh hoạt" description="Tên lớp chính quy, ví dụ K16-CNTT1" />
      </SettingsGroup>

      <SettingsGroup label="Ai thấy bạn">
        <SwitchRow
          {...bind('isPrivateProfile')}
          label="Hồ sơ riêng tư"
          description="Chỉ người đang theo dõi bạn mới xem được bài viết của bạn"
        />
        <SwitchRow
          {...bind('showActivityStatus')}
          label="Trạng thái hoạt động"
          description="Người cùng hội thoại thấy khi bạn đang online. Tắt thì bạn cũng không thấy của họ"
        />
      </SettingsGroup>

      <SettingsGroup label="Dữ liệu & gợi ý" hint="Tắt cá nhân hóa sẽ xóa ngay dữ liệu hành vi đã lưu.">
        <SwitchRow
          {...bind('personalization')}
          label="Cá nhân hóa gợi ý"
          description="Dùng bài bạn xem, tìm kiếm và tương tác để gợi ý bảng tin và PU AI"
        />
      </SettingsGroup>
    </>
  )
}
