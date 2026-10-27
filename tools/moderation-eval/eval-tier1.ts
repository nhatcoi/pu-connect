// Đo tầng 1 trên bộ thử: precision/recall theo nhóm + độ trễ. Chạy: cd apps/api && npx ts-node --transpile-only ../../tools/moderation-eval/eval-tier1.ts
import { checkVietnameseProfanity } from '../../apps/api/src/modules/moderation/vi-profanity.filter'

async function main() {
  const { DATA } = await import('./dataset.mjs')
  const rows = DATA.map((d: any) => {
    const r = checkVietnameseProfanity(d.text)
    return { ...d, flagged: r.verdict !== 'pass', verdict: r.verdict }
  })
  const groups = [...new Set(rows.map((r: any) => r.group))] as string[]
  for (const g of groups) {
    const rs = rows.filter((r: any) => r.group === g)
    const fl = rs.filter((r: any) => r.flagged).length
    console.log(`${g.padEnd(12)} n=${String(rs.length).padStart(3)} flagged=${String(fl).padStart(3)} (${((fl / rs.length) * 100).toFixed(0)}%)`)
  }
  const pos = rows.filter((r: any) => r.unsafe)
  const neg = rows.filter((r: any) => !r.unsafe && r.group !== 'casual' && r.group !== 'spam')
  const tp = pos.filter((r: any) => r.flagged).length
  const fp = neg.filter((r: any) => r.flagged).length
  console.log(`\nunsafe recall=${(tp / pos.length).toFixed(3)} precision=${(tp / (tp + fp)).toFixed(3)} fp=${fp}/${neg.length}`)
  console.log('MISSED:', pos.filter((r: any) => !r.flagged).map((r: any) => `[${r.group}] ${r.text}`))
  console.log('FALSE+:', neg.filter((r: any) => r.flagged).map((r: any) => `[${r.group}] ${r.text}`))
  const t0 = process.hrtime.bigint()
  for (let k = 0; k < 20; k++) for (const d of DATA) checkVietnameseProfanity(d.text)
  console.log(`latency ${(Number(process.hrtime.bigint() - t0) / 1e6 / (20 * DATA.length)).toFixed(4)} ms/câu`)
}
main()
