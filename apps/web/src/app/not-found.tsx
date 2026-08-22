import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center px-4">
      <h2 className="text-2xl font-bold">404 - Không tìm thấy trang</h2>
      <p className="text-sm text-muted-foreground">Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.</p>
      <Button asChild>
        <Link href="/">Quay về trang chủ</Link>
      </Button>
    </div>
  )
}
