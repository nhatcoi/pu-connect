// Suy thông tin hồ sơ từ email trường, ví dụ 22010001@phenikaa-uni.edu.vn
// → mã SV 22010001, khóa K16 (2022-2026). Chỉ là dữ liệu hồ sơ, KHÔNG dùng để cấp quyền.
const PHENIKAA_DOMAINS = ['phenikaa-uni.edu.vn', 'st.phenikaa-uni.edu.vn']

export function isPhenikaaEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && PHENIKAA_DOMAINS.includes(domain)
}

export function inferStudentInfoFromEmail(email: string): { studentId?: string; academicYear?: string } {
  if (!isPhenikaaEmail(email)) return {}
  const local = email.split('@')[0]
  // Mã sinh viên: 8 chữ số, 2 số đầu = năm nhập học (22 → 2022 → K16)
  if (!/^\d{8}$/.test(local)) return {}
  const startYear = 2000 + Number(local.slice(0, 2))
  const cohort = startYear - 2006
  if (cohort < 1 || startYear > new Date().getFullYear()) return { studentId: local }
  return { studentId: local, academicYear: `K${cohort} (${startYear}-${startYear + 4})` }
}
