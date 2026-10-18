// Danh mục tính năng PU Connector cho N7AI (tool puc__app_help): ở đâu, làm thế nào
// Feature catalog N7AI uses to answer "how do I…" questions and link to the right page; keep in sync with the web routes

export interface AppGuideEntry {
  id: string
  name: string
  href: string
  how: string
  keywords: string
}

export const APP_GUIDE: AppGuideEntry[] = [
  {
    id: 'feed',
    name: 'Bảng tin',
    href: '/',
    how: 'Xem và đăng bài: hỏi bài, chia sẻ tài liệu, khảo sát. Đổi chế độ Danh sách / Tập trung ở đầu bảng tin. Có thể tải lên tài liệu PDF, slide, đề thi khi soạn bài.',
    keywords: 'bang tin feed dang bai hoi bai tao bai viet tai lieu khao sat tap trung danh sach'
  },
  {
    id: 'search',
    name: 'Khám phá & tìm kiếm',
    href: '/search',
    how: 'Tìm bài viết, học phần, tài liệu & đề thi, người dùng, nhóm học; lọc theo loại và khoa; gõ #tag để tìm theo thẻ.',
    keywords: 'tim kiem kham pha search tag loc khoa'
  },
  {
    id: 'documents',
    name: 'Tài liệu & Đề thi',
    href: '/search?type=documents',
    how: 'Kho tài liệu, slide, đề thi theo học phần; tài liệu mới được chia sẻ qua bài viết trên bảng tin.',
    keywords: 'tai lieu de thi slide giao trinh pdf kho'
  },
  {
    id: 'courses',
    name: 'Học phần',
    href: '/courses',
    how: 'Trang từng học phần (/courses/<mã môn>) gom bài viết, tài liệu và nhóm học của môn; tham gia hoặc tạo nhóm học ở tab Nhóm học.',
    keywords: 'hoc phan mon hoc course nhom hoc tham gia nhom tao nhom pbl do an'
  },
  {
    id: 'communities',
    name: 'Cộng đồng',
    href: '/communities',
    how: 'Các cộng đồng theo khoa, câu lạc bộ, đời sống; tham gia để thấy bài của cộng đồng (/c/<slug>).',
    keywords: 'cong dong community clb cau lac bo khoa tham gia'
  },
  {
    id: 'tools',
    name: 'Công cụ học tập',
    href: '/tools',
    how: 'Flashcard ôn lặp lại ngắt quãng và Quiz trắc nghiệm; tự soạn, dán danh sách hoặc để N7AI tạo. Bộ N7AI tạo trong chat tự lưu vào đây.',
    keywords: 'cong cu flashcard the tu vung quiz trac nghiem on tap on thi lap lai ngat quang'
  },
  {
    id: 'messages',
    name: 'Tin nhắn',
    href: '/messages',
    how: 'Nhắn riêng, tạo nhóm chat; gõ @n7ai trong nhóm để hỏi N7AI cùng cả nhóm; ghim, trả lời, thả cảm xúc tin nhắn.',
    keywords: 'tin nhan chat nhan tin nhom chat dm'
  },
  {
    id: 'n7ai',
    name: 'N7AI',
    href: '/n7ai',
    how: 'Trợ lý học tập: 6 chế độ (Hỏi đáp, Giải thích, Quiz, Flashcard, Tóm tắt, Lộ trình ôn); gõ / để dùng skill, @ để gắn ngữ cảnh (học phần, tài liệu, bộ học tập, hội thoại cũ), nút + để bật nguồn / Research; chia sẻ hội thoại qua link.',
    keywords: 'n7ai tro ly ai chat skill ngu canh research chia se che do'
  },
  {
    id: 'n7ai_library',
    name: 'Thư viện N7AI',
    href: '/n7ai/library',
    how: 'Gom ảnh, tài liệu đã gửi cho N7AI và học liệu (quiz, flashcard) N7AI đã tạo.',
    keywords: 'thu vien n7ai anh tep link hoc lieu'
  },
  {
    id: 'n7ai_settings',
    name: 'Cài đặt N7AI',
    href: '/n7ai/settings',
    how: 'Hồ sơ học (mục tiêu, giới thiệu, cách trả lời), bộ nhớ (ghim, sửa, xóa), skill, tác vụ tự động theo lịch, trình kết nối (Google Drive, Lịch, Gmail), quyền riêng tư.',
    keywords: 'cai dat n7ai ho so hoc bo nho ghi nho skill tac vu tu dong ket noi google drive gmail lich'
  },
  {
    id: 'notifications',
    name: 'Thông báo',
    href: '/notifications',
    how: 'Lượt thích, trả lời, nhắc tên, theo dõi; chỉnh loại thông báo và giờ yên tĩnh trong Cài đặt › Thông báo.',
    keywords: 'thong bao notification'
  },
  {
    id: 'settings',
    name: 'Cài đặt tài khoản',
    href: '/settings',
    how: 'Tài khoản & xác thực sinh viên, đăng nhập & bảo mật, quyền riêng tư, tính năng, thông báo, giao diện, chặn.',
    keywords: 'cai dat tai khoan mat khau bao mat quyen rieng tu giao dien che do toi chan email'
  }
]
