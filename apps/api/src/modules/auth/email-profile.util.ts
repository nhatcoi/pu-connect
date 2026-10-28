// Suy thông tin hồ sơ từ email trường, ví dụ 22010001@phenikaa-uni.edu.vn
// → mã SV 22010001. Chỉ là dữ liệu hồ sơ, KHÔNG dùng để cấp quyền.
const PHENIKAA_DOMAINS = ['phenikaa-uni.edu.vn', 'st.phenikaa-uni.edu.vn']

export function isPhenikaaEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && PHENIKAA_DOMAINS.includes(domain)
}

export function inferStudentInfoFromEmail(email: string): { studentId?: string } {
  if (!isPhenikaaEmail(email)) return {}
  const local = email.split('@')[0]
  // Mã sinh viên: 8 chữ số
  return /^\d{8}$/.test(local) ? { studentId: local } : {}
}
