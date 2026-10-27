// Sidecar kiểm duyệt: chạy ViSoBERT ONNX trên Mac, VPS gọi qua reverse SSH tunnel (xem setup-moderation-tunnel.sh).
// Chạy từ apps/api: ts-node --transpile-only scripts/ops/moderation-sidecar.ts   (cổng MODERATION_SIDECAR_PORT, mặc định 11436, chỉ loopback)
import { createServer } from 'http'
import { join } from 'path'
import { OnnxToxicityClassifier } from '../../apps/api/src/modules/moderation/toxicity-classifier'
import { normalize } from '../../apps/api/src/modules/moderation/vi-text-normalizer'

const PORT = Number(process.env.MODERATION_SIDECAR_PORT || 11436)
const clf = new OnnxToxicityClassifier(process.env.MODERATION_MODEL_DIR || join(process.cwd(), 'models', 'visobert-onnx'))

// Giống ModerationService.modelText: dùng bản chuẩn hóa nếu phát hiện lách luật
const modelText = (text: string) => {
  const tokens = normalize(text)
  return tokens.some(t => t.altered) ? tokens.map(t => t.value).join(' ') : text
}

createServer((req, res) => {
  const send = (code: number, body: unknown) => (res.writeHead(code, { 'content-type': 'application/json' }), res.end(JSON.stringify(body)))
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true })
  if (req.method !== 'POST' || req.url !== '/classify') return send(404, { error: 'not found' })
  let raw = ''
  req.on('data', c => {
    raw += c
    if (raw.length > 20_000) req.destroy()
  })
  req.on('end', async () => {
    try {
      const { text } = JSON.parse(raw) as { text?: unknown }
      if (typeof text !== 'string' || !text.trim()) return send(400, { error: 'text required' })
      send(200, await clf.classify(modelText(text.slice(0, 4000))))
    } catch (err: any) {
      send(500, { error: err.message })
    }
  })
}).listen(PORT, '127.0.0.1', () => console.log(`moderation sidecar: http://127.0.0.1:${PORT}`))
