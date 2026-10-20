/**
 * @file academic-structure.ts
 * @description Hằng số học thuật Đại học Phenikaa còn dùng trong code (tên trường, niên khóa).
 *
 * Cây đơn vị (trường → khoa → ngành, viện, trung tâm) KHÔNG còn nằm trong code:
 * nó là bảng `academic_units` (admin sửa ở Học thuật › Đơn vị), web đọc qua `GET /api/academic-units`.
 * Kiểu dùng chung: xem `academic-unit.schema.ts`.
 */

export const PHENIKAA_UNIVERSITY_NAME = 'Trường Đại học Phenikaa'

export const PHENIKAA_ACADEMIC_YEARS = [
  { code: 'K19', label: 'Khóa K19 (2025 - 2029)', year: 2025 },
  { code: 'K18', label: 'Khóa K18 (2024 - 2028)', year: 2024 },
  { code: 'K17', label: 'Khóa K17 (2023 - 2027)', year: 2023 },
  { code: 'K16', label: 'Khóa K16 (2022 - 2026)', year: 2022 },
  { code: 'K15', label: 'Khóa K15 (2021 - 2025)', year: 2021 },
  { code: 'K14', label: 'Khóa K14 (2020 - 2024)', year: 2020 }
]
