import { redirect } from 'next/navigation'

// /home tự động chuyển về bảng tin mặc định /
export default function HomeRedirectPage() {
  redirect('/')
}
