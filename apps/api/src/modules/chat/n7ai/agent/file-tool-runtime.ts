import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Tìm file trong scripts/ (python script, font) qua các vị trí build khác nhau: dev, nest build (dist), VPS
export function repoScriptPath(...segments: string[]): string {
  const candidates = [
    path.resolve(process.cwd(), 'scripts', ...segments),
    path.resolve(__dirname, '../../../../../../scripts', ...segments),
    path.resolve(__dirname, ...segments)
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch {
      // thử đường dẫn tiếp theo
    }
  }
  return candidates[0]
}

// Chạy script tạo tệp (python-docx / openpyxl / reportlab): qua `uv run --with <gói>` (tự tải, cô lập,
// không cần cài sẵn) nếu có uv, ngược lại gọi python3 trực tiếp (yêu cầu gói đã cài sẵn trên máy)
export async function runGeneratorScript(scriptFile: string, pyPackages: string[], scriptArgs: string[], timeoutMs = 30_000): Promise<void> {
  const scriptPath = repoScriptPath(scriptFile)
  let cmd = 'uv'
  let args = ['run', ...pyPackages.flatMap((p) => ['--with', p]), 'python3', scriptPath, ...scriptArgs]
  try {
    await execFileAsync('which', ['uv'])
  } catch {
    cmd = 'python3'
    args = [scriptPath, ...scriptArgs]
  }
  await execFileAsync(cmd, args, { timeout: timeoutMs })
}

export const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// Tên tệp an toàn từ tiêu đề: bỏ dấu, chỉ còn chữ/số/gạch dưới
export function safeFileStem(title: string, fallback: string, maxLen = 50): string {
  const stem = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, maxLen)
  return stem || fallback
}

export async function writeTempJson(data: unknown, prefix = 'gen_in'): Promise<string> {
  const p = path.join(os.tmpdir(), `${prefix}_${genId()}.json`)
  await fs.writeFile(p, JSON.stringify(data), 'utf-8')
  return p
}

export function tempOutPath(ext: string, prefix = 'gen_out'): string {
  return path.join(os.tmpdir(), `${prefix}_${genId()}.${ext}`)
}

export async function cleanupFiles(...paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => fs.unlink(p).catch(() => undefined)))
}
