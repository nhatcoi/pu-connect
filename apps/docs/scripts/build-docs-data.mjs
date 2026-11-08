import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.resolve(__dirname, '../../../docs')
const OUTPUT_DIR = path.resolve(__dirname, '../src/data')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'docs.json')

// Nhóm tài liệu theo hệ thống. `order` là danh sách slug theo thứ tự hiển thị.
const CATEGORIES = [
  {
    id: 'start',
    title: 'Giới thiệu',
    description: 'Tổng quan sản phẩm, vai trò và thuật ngữ',
    order: ['index', 'product/overview', 'product/roles-permissions', 'product/glossary']
  },
  {
    id: 'guide',
    title: 'Hướng dẫn sử dụng',
    description: 'Cách dùng từng tính năng, từng bước',
    order: [
      'guide/bat-dau',
      'guide/giao-dien',
      'guide/dang-bai',
      'guide/binh-luan-hoi-dap',
      'guide/tim-kiem-thong-bao',
      'guide/nhan-tin',
      'guide/n7ai-bat-dau',
      'guide/n7ai-che-do-hoc',
      'guide/n7ai-ghi-chu',
      'guide/n7ai-nguon-tai-lieu',
      'guide/thu-vien-tai-lieu',
      'guide/cong-cu-hoc',
      'guide/nhom-hoc-cong-dong',
      'guide/cai-dat-tai-khoan',
      'guide/su-co-thuong-gap'
    ]
  },
  {
    id: 'web',
    title: 'PUC Web',
    description: 'Mạng xã hội học thuật dành cho người dùng',
    order: [
      'product/web/feed-posts',
      'product/web/comments-qa',
      'product/web/profile-follow',
      'product/web/search',
      'product/web/notifications',
      'product/web/messaging',
      'product/web/communities',
      'product/web/study-groups',
      'product/web/courses',
      'product/web/documents',
      'product/web/study-tools',
      'product/web/account-settings',
      'product/web/moderation'
    ]
  },
  {
    id: 'n7ai',
    title: 'N7AI',
    description: 'Trợ lý học tập AI',
    order: [
      'product/n7ai/overview',
      'product/n7ai/chat-workspace',
      'product/n7ai/learning-modes',
      'product/n7ai/agent-engine',
      'product/n7ai/sources-rag',
      'product/n7ai/phenikaa-knowledge-base',
      'product/n7ai/notes-memory-tasks',
      'product/n7ai/connectors',
      'product/n7ai/models-quota',
      'product/n7ai/in-app-context'
    ]
  },
  {
    id: 'admin',
    title: 'Admin Console',
    description: 'Cổng quản trị',
    order: [
      'product/admin/overview',
      'product/admin/users-security',
      'product/admin/moderation',
      'product/admin/academic-catalog',
      'product/admin/ai-operations',
      'product/admin/bots-news',
      'product/admin/announcements-groups'
    ]
  },
  {
    id: 'tech',
    title: 'Kỹ thuật và vận hành',
    description: 'Kiến trúc, API, cơ sở dữ liệu, triển khai',
    order: [
      'get-started',
      'architecture',
      'api-specification',
      'database-schema',
      'auth-google',
      'frontend-guide',
      'deployment-and-devops',
      'mobile-expansion',
      'seed',
      'content-moderation',
      'following',
      'logout',
      'academic-sharing-and-taxonomy-spec',
      'diagrams/README',
      'diagrams/01-system-context',
      'diagrams/02-containers',
      'diagrams/03-api-components',
      'diagrams/04-erd',
      'diagrams/05-flows',
      'diagrams/06-deployment',
      'diagrams/07-web-app'
    ]
  },
  {
    id: 'adr',
    title: 'Quyết định kiến trúc (ADR)',
    description: 'Ghi chép thiết kế chi tiết từng phân hệ',
    order: ['STUDENT_SOCIAL_NETWORK_MASTER_PLAN', 'core/README', 'core/FEATURE']
  },
  {
    id: 'changelog',
    title: 'Nhật ký thay đổi',
    description: 'Danh mục tính năng đã hoàn thành',
    order: ['FEAT']
  }
]

// Không bao giờ đưa lên site công khai: dữ liệu cá nhân, báo cáo học thuật, tệp nhị phân.
function isExcluded(relPath) {
  const p = relPath.replace(/\\/g, '/')
  if (/\.local\.md$/i.test(p)) return true
  if (p.startsWith('report/')) return true
  return false
}

function categorize(slug) {
  for (const cat of CATEGORIES) {
    const idx = cat.order.indexOf(slug)
    if (idx !== -1) return { categoryId: cat.id, order: idx }
  }
  if (slug.startsWith('core/')) {
    const m = slug.match(/^core\/(\d+)/)
    return { categoryId: 'adr', order: 10 + (m ? parseInt(m[1], 10) : 90) }
  }
  if (slug.startsWith('diagrams/')) return { categoryId: 'tech', order: 60 }
  if (slug.startsWith('guide/')) return { categoryId: 'guide', order: 90 }
  if (slug.startsWith('product/web/')) return { categoryId: 'web', order: 90 }
  if (slug.startsWith('product/n7ai/')) return { categoryId: 'n7ai', order: 90 }
  if (slug.startsWith('product/admin/')) return { categoryId: 'admin', order: 90 }
  return { categoryId: 'tech', order: 80 }
}

// Bỏ emoji và ký hiệu trang trí, giữ nguyên nội dung trong khối mã.
const DECOR = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}✅✔✓❌]/gu

function stripDecor(text) {
  return text.replace(DECOR, '').replace(/[ \t]+$/gm, '').replace(/\|[ ]{2,}/g, '| ')
}

function mapOutsideCode(markdown, fn) {
  const parts = markdown.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => (i % 2 === 1 ? part : fn(part))).join('')
}

function cleanTitle(text) {
  return text
    .replace(DECOR, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:–—-]+/, '')
    .trim()
}

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function headingPlainText(raw) {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim()
}

function extractHeadings(content) {
  const body = content.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ''))
  const headings = []
  const seen = new Map()
  let title = ''
  for (const line of body.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const level = m[1].length
    const text = cleanTitle(headingPlainText(m[2]))
    if (!text) continue
    if (level === 1) {
      if (!title) title = text
      continue
    }
    let id = slugify(text) || `muc-${headings.length}`
    const n = seen.get(id) || 0
    seen.set(id, n + 1)
    if (n > 0) id = `${id}-${n}`
    headings.push({ level, text, id })
  }
  return { title, headings }
}

// Chuyển liên kết tương đối giữa các tài liệu thành `#slug`; liên kết tới mã nguồn thì bỏ liên kết.
function rewriteLinks(content, relPath, slugSet) {
  const dir = path.posix.dirname(relPath.replace(/\\/g, '/'))
  return mapOutsideCode(content, (text) =>
    text.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, bang, label, target) => {
      if (bang) return match
      if (/^(https?:|mailto:|#)/.test(target)) return match
      const [rawPath, anchor] = target.split('#')
      const cleaned = rawPath.replace(/^file:\/\/.*?(\/docs\/)/, '').replace(/\.md$/, '')
      const candidates = [
        cleaned,
        path.posix.normalize(path.posix.join(dir, cleaned)),
        cleaned === '' ? '' : cleaned.replace(/\/$/, '')
      ].map((c) => c.replace(/^\.\//, '').replace(/\/README$/, '/README'))
      for (const c of candidates) {
        const slug = c === 'README' ? 'index' : c
        if (slugSet.has(slug)) return `[${label}](#${slug})`
      }
      if (rawPath === '' && anchor) return match
      return label.trim() ? `\`${label.replace(/`/g, '')}\`` : ''
    })
  )
}

function walkDocs(dir, rootDir = dir) {
  let results = []
  for (const file of fs.readdirSync(dir)) {
    if (file === '.DS_Store' || file === 'node_modules' || file === '.git') continue
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/')
    if (stat.isDirectory()) {
      if (isExcluded(relPath + '/')) continue
      results = results.concat(walkDocs(fullPath, rootDir))
    } else if (file.endsWith('.md') && !isExcluded(relPath)) {
      results.push({ fullPath, relPath })
    }
  }
  return results
}

function summarize(content) {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#+\s+.*$/gm, ' ')
    .replace(/\|[-: |]+\|/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain
}

function main() {
  console.log('Đang phân tích tài liệu từ:', DOCS_DIR)
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Không tìm thấy thư mục docs')
    process.exit(1)
  }

  const files = walkDocs(DOCS_DIR)
  const slugOf = (relPath) => {
    const s = relPath.replace(/\.md$/, '')
    return s === 'README' ? 'index' : s
  }
  const slugSet = new Set(files.map((f) => slugOf(f.relPath)))

  const docs = files.map(({ fullPath, relPath }) => {
    const slug = slugOf(relPath)
    const raw = fs.readFileSync(fullPath, 'utf8')
    let content = mapOutsideCode(raw, stripDecor)
    content = rewriteLinks(content, relPath, slugSet)

    let { title: h1, headings } = extractHeadings(content)
    // Neo trong trang kiểu cũ (có dấu tiếng Việt) chuyển sang id không dấu của tiêu đề
    const ids = new Set(headings.map((h) => h.id))
    content = mapOutsideCode(content, (text) =>
      text.replace(/\]\(#([^)\s]+)\)/g, (m, anchor) => {
        if (slugSet.has(anchor) || ids.has(anchor)) return m
        const fixed = slugify(decodeURIComponent(anchor))
        return ids.has(fixed) ? `](#${fixed})` : m
      })
    )
    const fallback = path.basename(relPath, '.md').replace(/[-_]/g, ' ')
    const title = h1 || fallback.charAt(0).toUpperCase() + fallback.slice(1)
    const plain = summarize(content)
    const { categoryId, order } = categorize(slug)

    return {
      id: slug,
      slug,
      relPath,
      title,
      categoryId,
      order,
      summary: plain.slice(0, 200) + (plain.length > 200 ? '...' : ''),
      headings,
      hasMermaid: content.includes('```mermaid'),
      content,
      searchSnippet: plain.slice(0, 600)
    }
  })

  const catIndex = new Map(CATEGORIES.map((c, i) => [c.id, i]))
  docs.sort((a, b) => {
    if (a.categoryId !== b.categoryId) return catIndex.get(a.categoryId) - catIndex.get(b.categoryId)
    if (a.order !== b.order) return a.order - b.order
    return a.title.localeCompare(b.title, 'vi')
  })

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalDocs: docs.length,
    categories: CATEGORIES.map(({ id, title, description }) => ({ id, title, description })),
    docs
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest), 'utf8')
  console.log(`Đã sinh dữ liệu cho ${docs.length} tài liệu: ${OUTPUT_FILE}`)
}

main()
