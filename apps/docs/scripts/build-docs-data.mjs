import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.resolve(__dirname, '../../../docs')
const OUTPUT_DIR = path.resolve(__dirname, '../src/data')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'docs.json')

// Định nghĩa cấu trúc danh mục và thứ tự ưu tiên
const CATEGORIES = [
  {
    id: 'overview',
    title: 'Tổng Quan & Bắt Đầu',
    icon: 'Rocket',
    badge: 'Khởi đầu'
  },
  {
    id: 'core',
    title: 'Kiến Trúc Cốt Lõi (ADRs)',
    icon: 'Layers',
    badge: 'Core Architecture'
  },
  {
    id: 'diagrams',
    title: 'Sơ Đồ Hệ Thống (Mermaid)',
    icon: 'GitFork',
    badge: 'C4 & Visual'
  },
  {
    id: 'api-db',
    title: 'API & Cơ Sở Dữ Liệu',
    icon: 'Database',
    badge: 'Contracts'
  },
  {
    id: 'guides',
    title: 'Vận Hành & Hướng Dẫn',
    icon: 'BookOpen',
    badge: 'DevOps & Rules'
  }
]

// Hàm làm sạch chuỗi thành slug id
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Bóc tách tiêu đề và trích xuất tóm tắt
function extractDocMeta(content, filePath, relPath) {
  const lines = content.split('\n')
  let title = ''
  const headings = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!title && trimmed.startsWith('# ')) {
      title = trimmed.replace(/^#\s+/, '').trim()
    } else if (trimmed.startsWith('## ')) {
      const headingText = trimmed.replace(/^##\s+/, '').trim()
      headings.push({
        level: 2,
        text: headingText,
        id: slugify(headingText) || `h2-${headings.length}`
      })
    } else if (trimmed.startsWith('### ')) {
      const headingText = trimmed.replace(/^###\s+/, '').trim()
      headings.push({
        level: 3,
        text: headingText,
        id: slugify(headingText) || `h3-${headings.length}`
      })
    }
  }

  // Fallback title nếu không có h1
  if (!title) {
    title = path.basename(filePath, '.md').replace(/[-_]/g, ' ')
    title = title.charAt(0).toUpperCase() + title.slice(1)
  }

  // Làm sạch tóm tắt
  const plainText = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#+\s+/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[*_~>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const summary = plainText.slice(0, 220) + (plainText.length > 220 ? '...' : '')

  return { title, headings, summary, plainText }
}

// Phân loại tài liệu
function categorizeDoc(relPath) {
  const normalized = relPath.replace(/\\/g, '/')

  if (normalized.startsWith('core/')) {
    return {
      categoryId: 'core',
      slug: normalized.replace(/\.md$/, ''),
      order: getCoreOrder(normalized)
    }
  }

  if (normalized.startsWith('diagrams/')) {
    return {
      categoryId: 'diagrams',
      slug: normalized.replace(/\.md$/, ''),
      order: getDiagramOrder(normalized)
    }
  }

  if (
    normalized.includes('api-specification') ||
    normalized.includes('database-schema') ||
    normalized.includes('auth-google') ||
    normalized.includes('academic-sharing')
  ) {
    return {
      categoryId: 'api-db',
      slug: normalized.replace(/\.md$/, ''),
      order: getApiOrder(normalized)
    }
  }

  if (
    normalized.includes('deployment') ||
    normalized.includes('frontend-guide') ||
    normalized.includes('mobile-expansion') ||
    normalized.includes('seed') ||
    normalized.includes('ACCOUNTS') ||
    normalized.includes('following') ||
    normalized.includes('logout')
  ) {
    return {
      categoryId: 'guides',
      slug: normalized.replace(/\.md$/, ''),
      order: getGuideOrder(normalized)
    }
  }

  return {
    categoryId: 'overview',
    slug: normalized === 'README.md' ? 'index' : normalized.replace(/\.md$/, ''),
    order: getOverviewOrder(normalized)
  }
}

function getOverviewOrder(file) {
  if (file === 'README.md') return 1
  if (file.includes('get-started')) return 2
  if (file.includes('architecture')) return 3
  if (file.includes('FEAT')) return 4
  if (file.includes('MASTER_PLAN')) return 5
  return 10
}

function getCoreOrder(file) {
  if (file === 'core/README.md') return 0
  const match = file.match(/core\/(\d+)/)
  return match ? parseInt(match[1], 10) : 99
}

function getDiagramOrder(file) {
  if (file === 'diagrams/README.md') return 0
  const match = file.match(/diagrams\/(\d+)/)
  return match ? parseInt(match[1], 10) : 99
}

function getApiOrder(file) {
  if (file.includes('api-specification')) return 1
  if (file.includes('database-schema')) return 2
  if (file.includes('auth-google')) return 3
  if (file.includes('academic-sharing')) return 4
  return 10
}

function getGuideOrder(file) {
  if (file.includes('deployment')) return 1
  if (file.includes('frontend-guide')) return 2
  if (file.includes('mobile-expansion')) return 3
  if (file.includes('seed')) return 4
  if (file.includes('ACCOUNTS')) return 5
  if (file.includes('following')) return 6
  if (file.includes('logout')) return 7
  return 10
}

function walkDocs(dir, rootDir = dir) {
  let results = []
  const list = fs.readdirSync(dir)

  for (const file of list) {
    if (file === '.DS_Store' || file === 'node_modules' || file === '.git') continue
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      // Bỏ qua thư mục report tài liệu word/template đồ án tốt nghiệp
      if (file === 'report') continue
      results = results.concat(walkDocs(fullPath, rootDir))
    } else if (file.endsWith('.md')) {
      const relPath = path.relative(rootDir, fullPath)
      results.push({ fullPath, relPath })
    }
  }
  return results
}

function main() {
  console.log('📚 Đang phân tích tài liệu từ:', DOCS_DIR)

  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Không tìm thấy thư mục docs!')
    process.exit(1)
  }

  const files = walkDocs(DOCS_DIR)
  const docs = []

  for (const { fullPath, relPath } of files) {
    const rawContent = fs.readFileSync(fullPath, 'utf8')
    const { title, headings, summary, plainText } = extractDocMeta(rawContent, fullPath, relPath)
    const { categoryId, slug, order } = categorizeDoc(relPath)

    // Nhận diện sơ đồ Mermaid
    const hasMermaid = rawContent.includes('```mermaid')

    docs.push({
      id: slug,
      slug,
      relPath,
      title,
      categoryId,
      order,
      summary,
      headings,
      hasMermaid,
      content: rawContent,
      // Search index tokens: cắt giảm text để dung lượng tối ưu
      searchSnippet: plainText.slice(0, 600)
    })
  }

  // Sắp xếp tài liệu theo Category và Order
  docs.sort((a, b) => {
    if (a.categoryId !== b.categoryId) {
      const catAIndex = CATEGORIES.findIndex((c) => c.id === a.categoryId)
      const catBIndex = CATEGORIES.findIndex((c) => c.id === b.categoryId)
      return catAIndex - catBIndex
    }
    return a.order - b.order
  })

  // Đảm bảo document đầu tiên là index
  const indexDoc = docs.find((d) => d.slug === 'index')
  if (indexDoc) {
    docs.splice(docs.indexOf(indexDoc), 1)
    docs.unshift(indexDoc)
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalDocs: docs.length,
    categories: CATEGORIES,
    docs
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`✅ Đã sinh thành công dữ liệu cho ${docs.length} tài liệu vào: ${OUTPUT_FILE}`)
}

main()
