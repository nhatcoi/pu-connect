/**
 * @file academic-structure.ts
 * @description Mô hình cây tổ chức học thuật chuẩn hóa của Đại học Phenikaa (PU Master Data)
 *
 * Cấu trúc phân cấp:
 * University (Đại học Phenikaa)
 *   ├── School (Trường thành viên)
 *   │     └── Faculty (Khoa trực thuộc)
 *   │           └── Major (Ngành / Chương trình đào tạo)
 *   ├── Faculty (Khoa độc lập trực thuộc Đại học)
 *   │     └── Major (Ngành đào tạo)
 *   ├── Institute (Viện nghiên cứu)
 *   └── Center (Trung tâm)
 */

export type AcademicUnitType = 'university' | 'school' | 'faculty' | 'major' | 'institute' | 'center'

export interface AcademicUnitItem {
  id: string
  name: string
  shortName?: string
  type: AcademicUnitType
  schoolName?: string
  facultyName?: string
  parentId?: string
  description?: string
}

export const PHENIKAA_UNIVERSITY_NAME = 'Trường Đại học Phenikaa'

export const PHENIKAA_ACADEMIC_YEARS = [
  { code: 'K19', label: 'Khóa K19 (2025 - 2029)', year: 2025 },
  { code: 'K18', label: 'Khóa K18 (2024 - 2028)', year: 2024 },
  { code: 'K17', label: 'Khóa K17 (2023 - 2027)', year: 2023 },
  { code: 'K16', label: 'Khóa K16 (2022 - 2026)', year: 2022 },
  { code: 'K15', label: 'Khóa K15 (2021 - 2025)', year: 2021 },
  { code: 'K14', label: 'Khóa K14 (2020 - 2024)', year: 2020 }
]

export const ACADEMIC_UNITS_DATA: AcademicUnitItem[] = [
  // ==========================================
  // 1. TRƯỜNG CÔNG NGHỆ THÔNG TIN PHENIKAA
  // ==========================================
  {
    id: 'school-it',
    name: 'Trường Công nghệ thông tin Phenikaa',
    shortName: 'Trường CNTT',
    type: 'school'
  },
  // Khoa Khoa học máy tính
  {
    id: 'fac-cs',
    name: 'Khoa Khoa học máy tính',
    shortName: 'Khoa KHMT',
    type: 'faculty',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    parentId: 'school-it'
  },
  {
    id: 'maj-cs',
    name: 'Khoa học máy tính',
    shortName: 'KHMT',
    type: 'major',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    facultyName: 'Khoa Khoa học máy tính',
    parentId: 'fac-cs'
  },
  {
    id: 'maj-se',
    name: 'Kỹ thuật phần mềm',
    shortName: 'KTPM',
    type: 'major',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    facultyName: 'Khoa Khoa học máy tính',
    parentId: 'fac-cs'
  },
  {
    id: 'maj-ce',
    name: 'Kỹ thuật máy tính',
    shortName: 'KTMT',
    type: 'major',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    facultyName: 'Khoa Khoa học máy tính',
    parentId: 'fac-cs'
  },
  // Khoa Hệ thống thông tin
  {
    id: 'fac-is',
    name: 'Khoa Hệ thống thông tin',
    shortName: 'Khoa HTTT',
    type: 'faculty',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    parentId: 'school-it'
  },
  {
    id: 'maj-is',
    name: 'Hệ thống thông tin',
    shortName: 'HTTT',
    type: 'major',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    facultyName: 'Khoa Hệ thống thông tin',
    parentId: 'fac-is'
  },
  {
    id: 'maj-net-sec',
    name: 'Mạng máy tính & An toàn thông tin',
    shortName: 'ATTT',
    type: 'major',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    facultyName: 'Khoa Hệ thống thông tin',
    parentId: 'fac-is'
  },
  // Khoa Trí tuệ nhân tạo & Khoa học dữ liệu
  {
    id: 'fac-ai-ds',
    name: 'Khoa Trí tuệ nhân tạo & Khoa học dữ liệu',
    shortName: 'Khoa AI & DS',
    type: 'faculty',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    parentId: 'school-it'
  },
  {
    id: 'maj-ai',
    name: 'Trí tuệ nhân tạo',
    shortName: 'AI',
    type: 'major',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    facultyName: 'Khoa Trí tuệ nhân tạo & Khoa học dữ liệu',
    parentId: 'fac-ai-ds'
  },
  {
    id: 'maj-ds',
    name: 'Khoa học dữ liệu',
    shortName: 'Data Science',
    type: 'major',
    schoolName: 'Trường Công nghệ thông tin Phenikaa',
    facultyName: 'Khoa Trí tuệ nhân tạo & Khoa học dữ liệu',
    parentId: 'fac-ai-ds'
  },

  // ==========================================
  // 2. TRƯỜNG KỸ THUẬT PHENIKAA
  // ==========================================
  {
    id: 'school-eng',
    name: 'Trường Kỹ thuật Phenikaa',
    shortName: 'Trường Kỹ thuật',
    type: 'school'
  },
  {
    id: 'fac-bio-chem-env',
    name: 'Khoa Công nghệ sinh học, Hóa học & Kỹ thuật môi trường',
    type: 'faculty',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    parentId: 'school-eng'
  },
  {
    id: 'maj-biotech',
    name: 'Công nghệ sinh học',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Công nghệ sinh học, Hóa học & Kỹ thuật môi trường',
    parentId: 'fac-bio-chem-env'
  },
  {
    id: 'maj-chem-env',
    name: 'Kỹ thuật Hóa học & Môi trường',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Công nghệ sinh học, Hóa học & Kỹ thuật môi trường',
    parentId: 'fac-bio-chem-env'
  },
  {
    id: 'fac-ee',
    name: 'Khoa Điện - Điện tử',
    shortName: 'Khoa ĐĐT',
    type: 'faculty',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    parentId: 'school-eng'
  },
  {
    id: 'maj-ee',
    name: 'Kỹ thuật Điện',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Điện - Điện tử',
    parentId: 'fac-ee'
  },
  {
    id: 'maj-ece',
    name: 'Kỹ thuật Điện tử - Viễn thông',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Điện - Điện tử',
    parentId: 'fac-ee'
  },
  {
    id: 'maj-auto',
    name: 'Kỹ thuật Điều khiển & Tự động hóa',
    shortName: 'Tự động hóa',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Điện - Điện tử',
    parentId: 'fac-ee'
  },
  {
    id: 'fac-mech',
    name: 'Khoa Cơ khí - Cơ điện tử',
    type: 'faculty',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    parentId: 'school-eng'
  },
  {
    id: 'maj-mech',
    name: 'Kỹ thuật Cơ khí',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Cơ khí - Cơ điện tử',
    parentId: 'fac-mech'
  },
  {
    id: 'maj-mechatronics',
    name: 'Kỹ thuật Cơ điện tử',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Cơ khí - Cơ điện tử',
    parentId: 'fac-mech'
  },
  {
    id: 'fac-materials',
    name: 'Khoa Khoa học & Kỹ thuật vật liệu',
    type: 'faculty',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    parentId: 'school-eng'
  },
  {
    id: 'maj-materials',
    name: 'Kỹ thuật Vật liệu',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Khoa học & Kỹ thuật vật liệu',
    parentId: 'fac-materials'
  },
  {
    id: 'fac-automotive',
    name: 'Khoa Kỹ thuật Ô tô & Năng lượng',
    type: 'faculty',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    parentId: 'school-eng'
  },
  {
    id: 'maj-automotive',
    name: 'Kỹ thuật Ô tô',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Kỹ thuật Ô tô & Năng lượng',
    parentId: 'fac-automotive'
  },
  {
    id: 'maj-energy',
    name: 'Kỹ thuật Năng lượng',
    type: 'major',
    schoolName: 'Trường Kỹ thuật Phenikaa',
    facultyName: 'Khoa Kỹ thuật Ô tô & Năng lượng',
    parentId: 'fac-automotive'
  },

  // ==========================================
  // 3. TRƯỜNG KINH TẾ PHENIKAA
  // ==========================================
  {
    id: 'school-econ',
    name: 'Trường Kinh tế Phenikaa',
    shortName: 'Trường Kinh tế',
    type: 'school'
  },
  {
    id: 'fac-ba',
    name: 'Khoa Quản trị kinh doanh',
    shortName: 'Khoa QTKD',
    type: 'faculty',
    schoolName: 'Trường Kinh tế Phenikaa',
    parentId: 'school-econ'
  },
  {
    id: 'maj-ba',
    name: 'Quản trị kinh doanh',
    shortName: 'QTKD',
    type: 'major',
    schoolName: 'Trường Kinh tế Phenikaa',
    facultyName: 'Khoa Quản trị kinh doanh',
    parentId: 'fac-ba'
  },
  {
    id: 'maj-mkt',
    name: 'Marketing',
    type: 'major',
    schoolName: 'Trường Kinh tế Phenikaa',
    facultyName: 'Khoa Quản trị kinh doanh',
    parentId: 'fac-ba'
  },
  {
    id: 'fac-ib',
    name: 'Khoa Kinh tế & Kinh doanh quốc tế',
    type: 'faculty',
    schoolName: 'Trường Kinh tế Phenikaa',
    parentId: 'school-econ'
  },
  {
    id: 'maj-ib',
    name: 'Kinh doanh quốc tế',
    type: 'major',
    schoolName: 'Trường Kinh tế Phenikaa',
    facultyName: 'Khoa Kinh tế & Kinh doanh quốc tế',
    parentId: 'fac-ib'
  },
  {
    id: 'maj-logistics',
    name: 'Logistics & Quản lý chuỗi cung ứng',
    shortName: 'Logistics',
    type: 'major',
    schoolName: 'Trường Kinh tế Phenikaa',
    facultyName: 'Khoa Kinh tế & Kinh doanh quốc tế',
    parentId: 'fac-ib'
  },
  {
    id: 'fac-fa',
    name: 'Khoa Tài chính - Kế toán',
    type: 'faculty',
    schoolName: 'Trường Kinh tế Phenikaa',
    parentId: 'school-econ'
  },
  {
    id: 'maj-finance',
    name: 'Tài chính - Ngân hàng',
    type: 'major',
    schoolName: 'Trường Kinh tế Phenikaa',
    facultyName: 'Khoa Tài chính - Kế toán',
    parentId: 'fac-fa'
  },
  {
    id: 'maj-accounting',
    name: 'Kế toán - Kiểm toán',
    type: 'major',
    schoolName: 'Trường Kinh tế Phenikaa',
    facultyName: 'Khoa Tài chính - Kế toán',
    parentId: 'fac-fa'
  },

  // ==========================================
  // 4. TRƯỜNG NGOẠI NGỮ – KHOA HỌC XÃ HỘI PHENIKAA
  // ==========================================
  {
    id: 'school-languages',
    name: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    shortName: 'Trường Ngoại ngữ & KHXH',
    type: 'school'
  },
  {
    id: 'fac-english',
    name: 'Khoa Ngôn ngữ Anh',
    type: 'faculty',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    parentId: 'school-languages'
  },
  {
    id: 'maj-english',
    name: 'Ngôn ngữ Anh',
    type: 'major',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    facultyName: 'Khoa Ngôn ngữ Anh',
    parentId: 'fac-english'
  },
  {
    id: 'fac-chinese',
    name: 'Khoa Ngôn ngữ Trung Quốc',
    type: 'faculty',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    parentId: 'school-languages'
  },
  {
    id: 'maj-chinese',
    name: 'Ngôn ngữ Trung Quốc',
    type: 'major',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    facultyName: 'Khoa Ngôn ngữ Trung Quốc',
    parentId: 'fac-chinese'
  },
  {
    id: 'fac-korean',
    name: 'Khoa Ngôn ngữ Hàn Quốc',
    type: 'faculty',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    parentId: 'school-languages'
  },
  {
    id: 'maj-korean',
    name: 'Ngôn ngữ Hàn Quốc',
    type: 'major',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    facultyName: 'Khoa Ngôn ngữ Hàn Quốc',
    parentId: 'fac-korean'
  },
  {
    id: 'fac-japanese',
    name: 'Khoa Ngôn ngữ Nhật Bản',
    type: 'faculty',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    parentId: 'school-languages'
  },
  {
    id: 'maj-japanese',
    name: 'Ngôn ngữ Nhật Bản',
    type: 'major',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    facultyName: 'Khoa Ngôn ngữ Nhật Bản',
    parentId: 'fac-japanese'
  },
  {
    id: 'fac-french',
    name: 'Khoa Ngôn ngữ Pháp',
    type: 'faculty',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    parentId: 'school-languages'
  },
  {
    id: 'fac-oriental',
    name: 'Khoa Đông phương học',
    type: 'faculty',
    schoolName: 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa',
    parentId: 'school-languages'
  },

  // ==========================================
  // 5. TRƯỜNG Y – DƯỢC PHENIKAA
  // ==========================================
  {
    id: 'school-health',
    name: 'Trường Y – Dược Phenikaa',
    shortName: 'Trường Y Dược',
    type: 'school'
  },
  {
    id: 'fac-medicine',
    name: 'Khoa Y',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },
  {
    id: 'maj-medicine',
    name: 'Y khoa',
    type: 'major',
    schoolName: 'Trường Y – Dược Phenikaa',
    facultyName: 'Khoa Y',
    parentId: 'fac-medicine'
  },
  {
    id: 'fac-dentistry',
    name: 'Khoa Răng Hàm Mặt',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },
  {
    id: 'maj-dentistry',
    name: 'Răng - Hàm - Mặt',
    type: 'major',
    schoolName: 'Trường Y – Dược Phenikaa',
    facultyName: 'Khoa Răng Hàm Mặt',
    parentId: 'fac-dentistry'
  },
  {
    id: 'fac-pharmacy',
    name: 'Khoa Dược',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },
  {
    id: 'maj-pharmacy',
    name: 'Dược học',
    type: 'major',
    schoolName: 'Trường Y – Dược Phenikaa',
    facultyName: 'Khoa Dược',
    parentId: 'fac-pharmacy'
  },
  {
    id: 'fac-nursing',
    name: 'Khoa Điều dưỡng',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },
  {
    id: 'maj-nursing',
    name: 'Điều dưỡng',
    type: 'major',
    schoolName: 'Trường Y – Dược Phenikaa',
    facultyName: 'Khoa Điều dưỡng',
    parentId: 'fac-nursing'
  },
  {
    id: 'fac-med-tech',
    name: 'Khoa Kỹ thuật Y học',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },
  {
    id: 'fac-biomed',
    name: 'Khoa Khoa học Y sinh',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },
  {
    id: 'fac-public-health',
    name: 'Khoa Y tế công cộng',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },
  {
    id: 'fac-traditional-med',
    name: 'Khoa Y học cổ truyền',
    type: 'faculty',
    schoolName: 'Trường Y – Dược Phenikaa',
    parentId: 'school-health'
  },

  // ==========================================
  // 6. TRƯỜNG CÔNG NGHỆ SỐ LIÊN NGÀNH PHENIKAA
  // ==========================================
  {
    id: 'school-digital',
    name: 'Trường Công nghệ số liên ngành Phenikaa',
    shortName: 'Trường CNSLN',
    type: 'school'
  },
  {
    id: 'fac-fintech',
    name: 'Khoa Kinh doanh & Tài chính số',
    type: 'faculty',
    schoolName: 'Trường Công nghệ số liên ngành Phenikaa',
    parentId: 'school-digital'
  },
  {
    id: 'maj-fintech',
    name: 'Công nghệ tài chính (Fintech)',
    shortName: 'Fintech',
    type: 'major',
    schoolName: 'Trường Công nghệ số liên ngành Phenikaa',
    facultyName: 'Khoa Kinh doanh & Tài chính số',
    parentId: 'fac-fintech'
  },
  {
    id: 'fac-ecom',
    name: 'Khoa Thương mại điện tử & Công nghệ số',
    type: 'faculty',
    schoolName: 'Trường Công nghệ số liên ngành Phenikaa',
    parentId: 'school-digital'
  },
  {
    id: 'maj-ecom',
    name: 'Thương mại điện tử',
    shortName: 'TMĐT',
    type: 'major',
    schoolName: 'Trường Công nghệ số liên ngành Phenikaa',
    facultyName: 'Khoa Thương mại điện tử & Công nghệ số',
    parentId: 'fac-ecom'
  },
  {
    id: 'fac-dig-media',
    name: 'Khoa Truyền thông số',
    type: 'faculty',
    schoolName: 'Trường Công nghệ số liên ngành Phenikaa',
    parentId: 'school-digital'
  },
  {
    id: 'maj-dig-media',
    name: 'Truyền thông đa phương tiện',
    type: 'major',
    schoolName: 'Trường Công nghệ số liên ngành Phenikaa',
    facultyName: 'Khoa Truyền thông số',
    parentId: 'fac-dig-media'
  },

  // ==========================================
  // 7. TRƯỜNG DU LỊCH PHENIKAA
  // ==========================================
  {
    id: 'school-tourism',
    name: 'Trường Du lịch Phenikaa',
    shortName: 'Trường Du lịch',
    type: 'school'
  },
  {
    id: 'fac-tourism-mgt',
    name: 'Khoa Quản trị Du lịch – Lữ hành',
    type: 'faculty',
    schoolName: 'Trường Du lịch Phenikaa',
    parentId: 'school-tourism'
  },
  {
    id: 'maj-tourism',
    name: 'Quản trị Dịch vụ du lịch & Lữ hành',
    type: 'major',
    schoolName: 'Trường Du lịch Phenikaa',
    facultyName: 'Khoa Quản trị Du lịch – Lữ hành',
    parentId: 'fac-tourism-mgt'
  },
  {
    id: 'fac-hotel-mgt',
    name: 'Khoa Quản trị Khách sạn – Nhà hàng',
    type: 'faculty',
    schoolName: 'Trường Du lịch Phenikaa',
    parentId: 'school-tourism'
  },
  {
    id: 'maj-hotel',
    name: 'Quản trị Khách sạn',
    type: 'major',
    schoolName: 'Trường Du lịch Phenikaa',
    facultyName: 'Khoa Quản trị Khách sạn – Nhà hàng',
    parentId: 'fac-hotel-mgt'
  },
  {
    id: 'fac-cul-tourism',
    name: 'Khoa Du lịch văn hóa & Cơ sở ngành',
    type: 'faculty',
    schoolName: 'Trường Du lịch Phenikaa',
    parentId: 'school-tourism'
  },

  // ==========================================
  // 8. KHOA ĐỘC LẬP (Trực thuộc Đại học)
  // ==========================================
  {
    id: 'fac-law',
    name: 'Khoa Luật',
    shortName: 'Khoa Luật',
    type: 'faculty',
    description: 'Khoa độc lập trực thuộc Đại học Phenikaa'
  },
  {
    id: 'maj-law-econ',
    name: 'Luật kinh tế',
    type: 'major',
    facultyName: 'Khoa Luật',
    parentId: 'fac-law'
  },
  {
    id: 'maj-law',
    name: 'Luật học',
    type: 'major',
    facultyName: 'Khoa Luật',
    parentId: 'fac-law'
  },
  {
    id: 'fac-basic-sci',
    name: 'Khoa Khoa học cơ bản',
    shortName: 'Khoa KHCB',
    type: 'faculty',
    description: 'Khoa độc lập trực thuộc Đại học Phenikaa'
  },

  // ==========================================
  // 9. CÁC VIỆN NGHIÊN CỨU
  // ==========================================
  {
    id: 'inst-pias',
    name: 'Viện Nghiên cứu tiên tiến Phenikaa',
    shortName: 'Viện PIAS',
    type: 'institute'
  },
  {
    id: 'inst-nano',
    name: 'Viện Nghiên cứu Nano',
    shortName: 'Viện PHENA',
    type: 'institute'
  },
  {
    id: 'inst-prati',
    name: 'Viện Nghiên cứu Công nghệ Phenikaa',
    shortName: 'Viện PRATI',
    type: 'institute'
  },

  // ==========================================
  // 10. CÁC TRUNG TÂM
  // ==========================================
  {
    id: 'center-it',
    name: 'Trung tâm Công nghệ thông tin',
    shortName: 'TT CNTT',
    type: 'center'
  },
  {
    id: 'center-languages-skills',
    name: 'Trung tâm Ngoại ngữ, Tin học & Kỹ năng',
    shortName: 'TT Ngoại ngữ & Tin học',
    type: 'center'
  },
  {
    id: 'center-isr',
    name: 'Trung tâm Nghiên cứu Xã hội liên ngành (ISR)',
    shortName: 'TT ISR',
    type: 'center'
  },
  {
    id: 'center-gene',
    name: 'Trung tâm Nghiên cứu Nguồn gen',
    shortName: 'TT Nguồn gen',
    type: 'center'
  }
]

/**
 * Tìm kiếm thông minh các đơn vị học thuật theo từ khóa
 */
export function searchAcademicUnits(keyword: string, limit = 10): AcademicUnitItem[] {
  if (!keyword || !keyword.trim()) {
    // Trả về top ngành phổ biến và trường
    return ACADEMIC_UNITS_DATA.filter((u) => u.type === 'major' || u.type === 'school').slice(0, limit)
  }

  const query = keyword.toLowerCase().trim()
  return ACADEMIC_UNITS_DATA.filter((unit) => {
    const nameMatch = unit.name.toLowerCase().includes(query)
    const shortMatch = unit.shortName ? unit.shortName.toLowerCase().includes(query) : false
    const schoolMatch = unit.schoolName ? unit.schoolName.toLowerCase().includes(query) : false
    const facultyMatch = unit.facultyName ? unit.facultyName.toLowerCase().includes(query) : false
    return nameMatch || shortMatch || schoolMatch || facultyMatch
  }).slice(0, limit)
}

/**
 * Tự động suy luận toàn bộ cây tổ chức (School, Faculty, Major) từ tên hoặc ID của một đơn vị bất kỳ
 */
export function inferAcademicHierarchy(unitNameOrId: string): {
  school: string | null
  faculty: string | null
  major: string | null
  type: AcademicUnitType
} {
  const normalized = unitNameOrId.trim().toLowerCase()
  const found = ACADEMIC_UNITS_DATA.find(
    (u) => u.id.toLowerCase() === normalized || u.name.toLowerCase() === normalized || (u.shortName && u.shortName.toLowerCase() === normalized)
  )

  if (!found) {
    return {
      school: null,
      faculty: null,
      major: unitNameOrId.trim(),
      type: 'major'
    }
  }

  if (found.type === 'major') {
    return {
      school: found.schoolName || null,
      faculty: found.facultyName || null,
      major: found.name,
      type: 'major'
    }
  }

  if (found.type === 'faculty') {
    return {
      school: found.schoolName || null,
      faculty: found.name,
      major: null,
      type: 'faculty'
    }
  }

  if (found.type === 'school') {
    return {
      school: found.name,
      faculty: null,
      major: null,
      type: 'school'
    }
  }

  // Viện hoặc Trung tâm
  return {
    school: null,
    faculty: found.name,
    major: null,
    type: found.type
  }
}
