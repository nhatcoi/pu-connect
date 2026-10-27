// Đo cả pipeline (tầng 1 + ViSoBERT ONNX trong Node + policy). Chạy từ apps/api:
// npx ts-node --transpile-only --compiler-options '{"module":"commonjs"}' ../../tools/moderation-eval/eval-pipeline.ts
import { join } from 'path'
import { decide } from '../../apps/api/src/modules/moderation/moderation.policy'
import { OnnxToxicityClassifier } from '../../apps/api/src/modules/moderation/toxicity-classifier'
import { checkVietnameseProfanity } from '../../apps/api/src/modules/moderation/vi-profanity.filter'
import { normalize } from '../../apps/api/src/modules/moderation/vi-text-normalizer'

async function main() {
  const { DATA } = await import('./dataset.mjs')
  const clf = new OnnxToxicityClassifier(join(process.cwd(), 'models', 'visobert-onnx'))
  await clf.classify('xin chào') // warm-up
  const rows: any[] = []
  const lat: number[] = []
  for (const d of DATA as any[]) {
    const t0 = performance.now()
    const t1 = checkVietnameseProfanity(d.text)
    const tk = normalize(d.text)
    const scores = t1.verdict === 'block' ? null : await clf.classify(tk.some(t => t.altered) ? tk.map(t => t.value).join(' ') : d.text)
    const dec = decide(t1, scores)
    lat.push(performance.now() - t0)
    rows.push({ ...d, action: dec.action, scores })
  }
  const by: Record<string, Record<string, number>> = {}
  for (const r of rows) ((by[r.group] ??= {})[r.action] = (by[r.group][r.action] ?? 0) + 1)
  console.table(by)
  const flagged = (r: any) => r.action !== 'allow'
  const pos = rows.filter(r => r.unsafe)
  const neg = rows.filter(r => !r.unsafe && r.group !== 'casual' && r.group !== 'spam')
  const tp = pos.filter(flagged).length, fp = neg.filter(flagged).length
  console.log(`recall=${(tp / pos.length).toFixed(3)} precision=${(tp / (tp + fp)).toFixed(3)} fp=${fp}/${neg.length}`)
  console.log('hold (hate) trên câu lành:', neg.filter(r => r.action === 'hold').map(r => r.text))
  console.log('block trên câu lành:', neg.filter(r => r.action === 'block').map(r => r.text))
  lat.sort((a, b) => a - b)
  console.log(`latency p50=${lat[Math.floor(lat.length / 2)].toFixed(1)}ms p95=${lat[Math.floor(lat.length * 0.95)].toFixed(1)}ms`)
  console.log('RSS MB', Math.round(process.memoryUsage().rss / 1e6))
}
main()
