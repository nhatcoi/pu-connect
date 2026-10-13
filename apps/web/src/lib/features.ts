// Feature flags: ẩn tính năng chưa có backend / dữ liệu thật
// Bật lại = đổi sang true khi tính năng hoàn thiện
export const FEATURES = {
  // Landing: thẻ QR tải app mobile (chưa phát hành)
  mobileAppPromo: false,
  // Sidebar/mobile nav: Học phần, Tài liệu, Hỏi đáp (search bỏ qua `type` khi không có từ khóa)
  categoryShortcuts: false,
  // Sidebar: "Môn học sôi nổi" (dữ liệu cứng, link chết)
  hotCourses: false,
  // Cột phải & Khám phá: xu hướng, tin nổi bật, học phần hot (số liệu cứng)
  trending: false,
  // Khám phá: sub-tab (chưa lọc nội dung)
  exploreSubTabs: false,
  // Bài viết: lượt xem & phân tích (số liệu tự tính, không có tracking)
  postAnalytics: false,
  // Chia sẻ bài viết vào chat (cần bộ chọn hội thoại; DM từ hồ sơ đã bật)
  directMessage: false,
  // Composer: chọn đối tượng xem (backend chưa lưu)
  postAudience: false,
} as const
