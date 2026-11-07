'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { compileConstraints, compileFunction, compileRelation } from './plot-math'
import { FigureFrame, serializeSvg, useThrottledValue } from './figure-frame'
import { parsePartialJson } from './partial-json'

/**
 * Khối ```plot — AI chỉ KHAI BÁO (hàm, đường, miền, điểm…) bằng JSON; toạ độ do trình duyệt tính ⇒ chính xác.
 *
 * {"title":"…","x":[-1,5],"y":[-1,5],"xlabel":"x₁","ylabel":"x₂",
 *  "functions":["y=x^2",{"expr":"sin(x)","color":"red","label":"sin x","domain":[0,6.28]}],
 *  "curves":["x^2+y^2=1","x+y=4"],              // đường ẩn / đường thẳng
 *  "regions":[{"where":"x>=0, y>=0, x+y<=4","label":"Ω","color":"blue"}],
 *  "polygons":[{"points":[[0,0],[4,0],[0,4]],"label":"OAB"}],
 *  "segments":[{"from":[0,0],"to":[4,0],"dash":true}],
 *  "points":[{"x":4,"y":0,"label":"A"}],"texts":[{"x":1,"y":1,"text":"…"}]}
 */

export const COLORS: Record<string, string> = {
  blue: '#3b82f6', red: '#ef4444', green: '#22c55e', amber: '#f59e0b', yellow: '#eab308', purple: '#8b5cf6',
  teal: '#14b8a6', pink: '#ec4899', gray: '#71717a', grey: '#71717a', orange: '#f97316', black: '#52525b'
}
export const CYCLE = ['blue', 'red', 'green', 'amber', 'purple', 'teal', 'pink', 'orange']
export const color = (v: unknown, i: number): string => {
  if (typeof v === 'string') {
    const k = v.toLowerCase().trim()
    if (COLORS[k]) return COLORS[k]
    if (/^#[0-9a-f]{3,8}$/i.test(k)) return k
  }
  return COLORS[CYCLE[i % CYCLE.length]]
}

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', n: 'ₙ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ' }
const SUPR: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', n: 'ⁿ' }
/** Nhãn đẹp hơn: x_1 → x₁, x^2 → x², <= → ≤, >= → ≥, * → ·, bỏ dấu $. */
export const pretty = (s: string): string =>
  s
    .replace(/\$/g, '')
    .replace(/_\{?([0-9nijk]+)\}?/g, (_m, d: string) => [...d].map((c) => SUB[c] ?? c).join(''))
    .replace(/\^\{?([0-9n]+)\}?/g, (_m, d: string) => [...d].map((c) => SUPR[c] ?? c).join(''))
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/\\(le|leq)\b/g, '≤')
    .replace(/\\(ge|geq)\b/g, '≥')
    .replace(/\\(Omega)\b/g, 'Ω')
    .replace(/\\(alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma)\b/g, (_m, g: string) => ({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ' })[g] ?? g)
    .replace(/\*/g, '·')

export const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}
const pair = (v: unknown): [number, number] | undefined => {
  if (!Array.isArray(v)) return undefined
  const a = num(v[0])
  const b = num(v[1])
  return a !== undefined && b !== undefined ? [a, b] : undefined
}
export const rec = (v: unknown): Record<string, unknown> | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined)
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
export const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

const W = 640
const PAD = { l: 38, r: 18, t: 14, b: 30 }

export function niceStep(span: number, target = 8): number {
  const raw = span / target
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow
}
export const fmt = (v: number, step: number): string => {
  const d = Math.max(0, -Math.floor(Math.log10(step)))
  const s = v.toFixed(Math.min(d, 6))
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

interface Scene {
  w: number
  h: number
  nodes: React.ReactNode[]
  issues: string[]
}

function build(spec: Record<string, unknown>, uid: string): Scene {
  const issues: string[] = []
  const nodes: React.ReactNode[] = []

  // ── Chuẩn hóa dữ liệu (mục dở dang / sai bị bỏ qua, không làm hỏng cả hình) ──
  const points = list(spec.points)
    .map((p, i) => {
      const o = rec(p)
      const arr = Array.isArray(p) ? p : undefined
      const xy = pair(arr ?? o?.at ?? (o ? [o.x, o.y] : undefined))
      return xy ? { xy, label: str(o?.label ?? arr?.[2]), color: color(o?.color, i + 1) } : null
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
  const polygons = list(spec.polygons)
    .map((p, i) => {
      const o = rec(p)
      const pts = list(o?.points ?? p).map(pair).filter((q): q is [number, number] => !!q)
      return pts.length >= 2 ? { pts, label: str(o?.label), color: color(o?.color, i), fill: o?.fill !== false, dash: o?.dash === true } : null
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
  const segments = list(spec.segments)
    .map((s, i) => {
      const o = rec(s)
      const a = pair(o?.from ?? (Array.isArray(s) ? s[0] : undefined))
      const b = pair(o?.to ?? (Array.isArray(s) ? s[1] : undefined))
      return a && b ? { a, b, label: str(o?.label), color: color(o?.color, i), dash: o?.dash === true, arrow: o?.arrow === true } : null
    })
    .filter((s): s is NonNullable<typeof s> => !!s)
  const texts = list(spec.texts)
    .map((t, i) => {
      const o = rec(t)
      const xy = pair([o?.x, o?.y])
      const text = str(o?.text)
      return xy && text ? { xy, text, color: color(o?.color, i + 3) } : null
    })
    .filter((t): t is NonNullable<typeof t> => !!t)

  // ── Khoảng hiển thị ──
  const xs: number[] = []
  const ys: number[] = []
  const add = (p: [number, number]) => {
    xs.push(p[0])
    ys.push(p[1])
  }
  points.forEach((p) => add(p.xy))
  polygons.forEach((p) => p.pts.forEach(add))
  segments.forEach((s) => {
    add(s.a)
    add(s.b)
  })
  texts.forEach((t) => add(t.xy))

  const range = (given: [number, number] | undefined, data: number[], fallback: [number, number]): [number, number] => {
    if (given && given[1] > given[0]) return given
    if (data.length === 0) return fallback
    let lo = Math.min(...data)
    let hi = Math.max(...data)
    const span = hi - lo || 2
    if (lo > 0) lo = -0.12 * hi
    if (hi < 0) hi = -0.12 * lo
    const pad = (hi - lo || span) * 0.12
    return [lo - pad, hi + pad]
  }
  const [xmin0, xmax0] = range(pair(spec.x), xs, [-6, 6])

  // Hàm số: lấy mẫu để đoán khoảng y khi chưa khai báo
  const fnSpecs = list(spec.functions)
    .map((f, i) => {
      const o = rec(f)
      const expr = str(typeof f === 'string' ? f : o?.expr)
      return expr ? { expr, label: str(o?.label), color: color(o?.color, i), dash: o?.dash === true, domain: pair(o?.domain) } : null
    })
    .filter((f): f is NonNullable<typeof f> => !!f)
  const curveSpecs = [
    ...list(spec.curves).map((c, i) => {
      const o = rec(c)
      const eq = str(typeof c === 'string' ? c : (o?.eq ?? o?.expr))
      return eq ? { eq, label: str(o?.label), color: color(o?.color, i + 1), dash: o?.dash === true } : null
    })
  ].filter((c): c is NonNullable<typeof c> => !!c)

  const compiledFns: { f: (x: number) => number; spec: (typeof fnSpecs)[number] }[] = []
  for (const s of fnSpecs) {
    try {
      const f = compileFunction(s.expr)
      if (f) compiledFns.push({ f, spec: s })
      else curveSpecs.push({ eq: s.expr, label: s.label, color: s.color, dash: s.dash }) // "x = 2" gõ nhầm vào functions
    } catch (e) {
      issues.push(`Hàm "${s.expr}": ${(e as Error).message}`)
    }
  }

  let yGiven = pair(spec.y)
  if (!(yGiven && yGiven[1] > yGiven[0]) && ys.length === 0 && compiledFns.length) {
    const samples: number[] = []
    for (const { f, spec: s } of compiledFns) {
      const [a, b] = s.domain ?? [xmin0, xmax0]
      for (let i = 0; i <= 200; i++) {
        const v = f(a + ((b - a) * i) / 200)
        if (Number.isFinite(v) && Math.abs(v) < 1e6) samples.push(v)
      }
    }
    if (samples.length) {
      samples.sort((p, q) => p - q)
      const lo = samples[Math.floor(samples.length * 0.03)]
      const hi = samples[Math.ceil(samples.length * 0.97) - 1]
      // Không để hàm tăng nhanh / tiệm cận kéo giãn trục y quá xa so với trục x
      const cap = (xmax0 - xmin0) * 0.6
      const lo2 = Math.max(Math.min(lo, 0), -cap)
      const hi2 = Math.min(Math.max(hi, 0), cap)
      const pad = (hi2 - lo2 || 2) * 0.08
      yGiven = [lo2 - pad, hi2 + pad]
    }
  }
  let [ymin, ymax] = range(yGiven, ys, [-6, 6])
  let xmin = xmin0
  let xmax = xmax0

  // ── Khung & tỉ lệ (mặc định xích đều 2 trục để đường tròn vẫn tròn) ──
  const areaW = W - PAD.l - PAD.r
  let sx = areaW / (xmax - xmin)
  let areaH = (ymax - ymin) * sx
  const H_MIN = 200
  const H_MAX = 460
  let sy = sx
  if (spec.equal === false) {
    areaH = Math.min(H_MAX, Math.max(H_MIN, areaH))
    sy = areaH / (ymax - ymin)
  } else if (areaH > H_MAX) {
    areaH = H_MAX
    sx = sy = areaH / (ymax - ymin)
    const cx = (xmin + xmax) / 2
    const half = areaW / sx / 2
    xmin = cx - half
    xmax = cx + half
  } else if (areaH < H_MIN) {
    areaH = H_MIN
    sy = sx
    const cy = (ymin + ymax) / 2
    const half = areaH / sy / 2
    ymin = cy - half
    ymax = cy + half
  } else sy = sx
  const H = PAD.t + areaH + PAD.b
  const px = (x: number) => PAD.l + (x - xmin) * sx
  const py = (y: number) => PAD.t + areaH - (y - ymin) * sy
  const clipId = `plot-clip-${uid}`
  const arrowId = `plot-arrow-${uid}`
  let key = 0
  const k = () => `n${key++}`

  nodes.push(
    <defs key="defs">
      <clipPath id={clipId}>
        <rect x={PAD.l} y={PAD.t} width={areaW} height={areaH} />
      </clipPath>
      <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M1 1L9 5L1 9z" fill="currentColor" />
      </marker>
    </defs>
  )

  // ── Lưới + trục ──
  const stepX = niceStep(xmax - xmin)
  const stepY = niceStep(ymax - ymin)
  const grid: React.ReactNode[] = []
  const tickNodes: React.ReactNode[] = []
  const axisY = ymin <= 0 && ymax >= 0 ? py(0) : PAD.t + areaH
  const axisX = xmin <= 0 && xmax >= 0 ? px(0) : PAD.l
  if (spec.grid !== false) {
    for (let v = Math.ceil(xmin / stepX) * stepX; v <= xmax + 1e-9; v += stepX)
      grid.push(<line key={`gx${v}`} x1={px(v)} y1={PAD.t} x2={px(v)} y2={PAD.t + areaH} stroke="currentColor" strokeOpacity={0.09} />)
    for (let v = Math.ceil(ymin / stepY) * stepY; v <= ymax + 1e-9; v += stepY)
      grid.push(<line key={`gy${v}`} x1={PAD.l} y1={py(v)} x2={PAD.l + areaW} y2={py(v)} stroke="currentColor" strokeOpacity={0.09} />)
  }
  for (let v = Math.ceil(xmin / stepX) * stepX; v <= xmax + 1e-9; v += stepX) {
    if (Math.abs(v) < stepX * 1e-6) continue
    tickNodes.push(
      <text key={`tx${v}`} x={px(v)} y={Math.min(axisY + 14, PAD.t + areaH + 14)} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.6}>
        {fmt(v, stepX)}
      </text>
    )
  }
  for (let v = Math.ceil(ymin / stepY) * stepY; v <= ymax + 1e-9; v += stepY) {
    if (Math.abs(v) < stepY * 1e-6) continue
    tickNodes.push(
      <text key={`ty${v}`} x={Math.max(axisX - 6, PAD.l - 4)} y={py(v) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.6}>
        {fmt(v, stepY)}
      </text>
    )
  }
  nodes.push(<g key="grid">{grid}</g>)
  nodes.push(
    <g key="axes" color="currentColor">
      <line x1={PAD.l} y1={axisY} x2={PAD.l + areaW + 8} y2={axisY} stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.4} markerEnd={`url(#${arrowId})`} />
      <line x1={axisX} y1={PAD.t + areaH} x2={axisX} y2={PAD.t - 8} stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.4} markerEnd={`url(#${arrowId})`} />
      {xmin <= 0 && xmax >= 0 && ymin <= 0 && ymax >= 0 && (
        <text x={axisX - 6} y={axisY + 14} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.6}>
          O
        </text>
      )}
      <text x={PAD.l + areaW + 6} y={axisY - 7} textAnchor="end" fontSize={13} fontStyle="italic" fill="currentColor">
        {pretty(str(spec.xlabel) ?? 'x')}
      </text>
      <text x={axisX + 8} y={PAD.t + 4} fontSize={13} fontStyle="italic" fill="currentColor">
        {pretty(str(spec.ylabel) ?? 'y')}
      </text>
      {tickNodes}
    </g>
  )

  const halo = { paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3.5, strokeLinejoin: 'round' } as const
  const label = (text: string, x: number, y: number, c: string, anchor: 'start' | 'middle' | 'end' = 'start') => (
    <text key={k()} className="plot-in" x={x} y={y} textAnchor={anchor} fontSize={13} fontWeight={600} fill={c} style={halo}>
      {pretty(text)}
    </text>
  )

  // ── Miền (tô theo ô lưới) ──
  const regionNodes: React.ReactNode[] = []
  const regionLabels: React.ReactNode[] = []
  list(spec.regions).forEach((r, i) => {
    const o = rec(r)
    const where = str(typeof r === 'string' ? r : (o?.where ?? o?.expr))
    if (!where) return
    try {
      const inside = compileConstraints(where)
      const c = color(o?.color, i)
      const cols = 150
      const rows = Math.max(20, Math.round((cols * areaH) / areaW))
      const cw = areaW / cols
      const ch = areaH / rows
      let d = ''
      let sxs = 0
      let sys = 0
      let cnt = 0
      for (let j = 0; j < rows; j++) {
        let run = -1
        for (let n = 0; n <= cols; n++) {
          const on = n < cols && inside(xmin + ((n + 0.5) / cols) * (xmax - xmin), ymax - ((j + 0.5) / rows) * (ymax - ymin))
          if (on) {
            sxs += n
            sys += j
            cnt++
            if (run < 0) run = n
          } else if (run >= 0) {
            d += `M${(PAD.l + run * cw).toFixed(1)} ${(PAD.t + j * ch).toFixed(1)}h${((n - run) * cw).toFixed(1)}v${(ch + 0.4).toFixed(1)}h${(-(n - run) * cw).toFixed(1)}z`
            run = -1
          }
        }
      }
      if (d) regionNodes.push(<path key={`r${i}`} className="plot-in" d={d} fill={c} fillOpacity={0.2} />)
      const lb = str(o?.label)
      if (lb && cnt) regionLabels.push(label(lb, PAD.l + (sxs / cnt + 0.5) * cw, PAD.t + (sys / cnt + 0.5) * ch + 4, c, 'middle'))
    } catch (e) {
      issues.push(`Miền "${where}": ${(e as Error).message}`)
    }
  })
  nodes.push(
    <g key="regions" clipPath={`url(#${clipId})`}>
      {regionNodes}
    </g>
  )

  // ── Đa giác ──
  polygons.forEach((p) => {
    const d = p.pts.map((q, n) => `${n ? 'L' : 'M'}${px(q[0]).toFixed(1)} ${py(q[1]).toFixed(1)}`).join('') + (p.pts.length > 2 ? 'Z' : '')
    nodes.push(<path key={k()} className="plot-in" d={d} fill={p.fill && p.pts.length > 2 ? p.color : 'none'} fillOpacity={0.18} stroke={p.color} strokeWidth={2} strokeLinejoin="round" strokeDasharray={p.dash ? '6 4' : undefined} />)
    if (p.label) {
      const cx = p.pts.reduce((s, q) => s + q[0], 0) / p.pts.length
      const cy = p.pts.reduce((s, q) => s + q[1], 0) / p.pts.length
      nodes.push(label(p.label, px(cx), py(cy) + 4, p.color, 'middle'))
    }
  })

  // ── Đồ thị hàm y = f(x) ──
  compiledFns.forEach(({ f, spec: s }) => {
    const [a, b] = s.domain ?? [xmin, xmax]
    const n = 600
    let d = ''
    let pen = false
    let prevY = NaN
    let last: [number, number] | null = null
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n
      const y = f(x)
      const yy = py(y)
      if (!Number.isFinite(y) || Math.abs(yy) > 1e5 || (pen && Math.abs(yy - prevY) > areaH * 1.5)) {
        pen = false
        prevY = NaN
        continue
      }
      d += `${pen ? 'L' : 'M'}${px(x).toFixed(1)} ${yy.toFixed(1)}`
      pen = true
      prevY = yy
      if (x >= xmin && x <= xmax && yy >= PAD.t && yy <= PAD.t + areaH) last = [px(x), yy]
    }
    nodes.push(
      <g key={k()} clipPath={`url(#${clipId})`}>
        <path className="plot-in" d={d} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeDasharray={s.dash ? '6 4' : undefined} />
      </g>
    )
    if (s.label && last) nodes.push(label(s.label, Math.min(last[0] - 4, PAD.l + areaW - 4), Math.max(last[1] - 8, PAD.t + 12), s.color, 'end'))
  })

  // ── Đường ẩn F(x,y)=0 (đường thẳng, đường tròn, elip…) bằng marching squares ──
  curveSpecs.forEach((cs) => {
    try {
      const { f } = compileRelation(cs.eq)
      const cols = 140
      const rows = Math.max(40, Math.round((cols * areaH) / areaW))
      const X = (n: number) => xmin + (n / cols) * (xmax - xmin)
      const Y = (j: number) => ymax - (j / rows) * (ymax - ymin)
      const grid2: number[][] = []
      for (let j = 0; j <= rows; j++) {
        const row: number[] = []
        for (let n = 0; n <= cols; n++) row.push(f(X(n), Y(j)))
        grid2.push(row)
      }
      let d = ''
      let mid: [number, number] | null = null
      const cross = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number): [number, number] | null => {
        if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 === v2 || v1 > 0 === v2 > 0) return null
        const t = v1 / (v1 - v2)
        return [px(x1 + (x2 - x1) * t), py(y1 + (y2 - y1) * t)]
      }
      for (let j = 0; j < rows; j++) {
        for (let n = 0; n < cols; n++) {
          const a = grid2[j][n]
          const b = grid2[j][n + 1]
          const c = grid2[j + 1][n + 1]
          const dd = grid2[j + 1][n]
          const x0 = X(n)
          const x1 = X(n + 1)
          const yT = Y(j)
          const yB = Y(j + 1)
          const top = cross(x0, yT, a, x1, yT, b)
          const right = cross(x1, yT, b, x1, yB, c)
          const bottom = cross(x0, yB, dd, x1, yB, c)
          const left = cross(x0, yT, a, x0, yB, dd)
          const pts = [top, right, bottom, left].filter((p): p is [number, number] => !!p)
          const seg = (p: [number, number], q: [number, number]) => {
            d += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`
            if (!mid) mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
          }
          if (pts.length === 2) seg(pts[0], pts[1])
          else if (pts.length === 4) {
            seg(top!, left!)
            seg(bottom!, right!)
          }
        }
      }
      nodes.push(
        <g key={k()} clipPath={`url(#${clipId})`}>
          <path className="plot-in" d={d} fill="none" stroke={cs.color} strokeWidth={2.2} strokeLinecap="round" strokeDasharray={cs.dash ? '6 4' : undefined} />
        </g>
      )
      if (cs.label && mid) nodes.push(label(cs.label, (mid as [number, number])[0] + 6, (mid as [number, number])[1] - 6, cs.color))
    } catch (e) {
      issues.push(`Đường "${cs.eq}": ${(e as Error).message}`)
    }
  })

  nodes.push(...regionLabels)

  // ── Đoạn thẳng ──
  segments.forEach((s) => {
    nodes.push(
      <line
        key={k()}
        className="plot-in"
        x1={px(s.a[0])}
        y1={py(s.a[1])}
        x2={px(s.b[0])}
        y2={py(s.b[1])}
        stroke={s.color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray={s.dash ? '6 4' : undefined}
        color={s.color}
        markerEnd={s.arrow ? `url(#${arrowId})` : undefined}
      />
    )
    if (s.label) nodes.push(label(s.label, (px(s.a[0]) + px(s.b[0])) / 2 + 6, (py(s.a[1]) + py(s.b[1])) / 2 - 6, s.color))
  })

  // ── Điểm + chữ ──
  points.forEach((p) => {
    nodes.push(<circle key={k()} className="plot-in" cx={px(p.xy[0])} cy={py(p.xy[1])} r={4.5} fill={p.color} stroke="var(--card)" strokeWidth={1.5} />)
    if (p.label) nodes.push(label(p.label, px(p.xy[0]) + 8, py(p.xy[1]) - 8, p.color))
  })
  texts.forEach((t) => nodes.push(label(t.text, px(t.xy[0]), py(t.xy[1]), t.color, 'middle')))

  return { w: W, h: H, nodes, issues }
}

/** Đồ thị / hình học toạ độ từ JSON khai báo. Vẽ dần khi JSON còn đang stream. */
export function PlotBlock({ content, code }: { content: string; code?: React.ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const src = useThrottledValue(content)
  const boxRef = useRef<HTMLDivElement>(null)
  const complete = useMemo(() => {
    try {
      JSON.parse(content)
      return true
    } catch {
      return false
    }
  }, [content])
  const spec = useMemo(() => {
    const v = parsePartialJson(src)
    return rec(v)
  }, [src])
  const scene = useMemo(() => {
    if (!spec) return null
    try {
      return build(spec, uid)
    } catch {
      return null
    }
  }, [spec, uid])

  // Dữ liệu đã dừng đổi mà vẫn không đọc được ⇒ báo lỗi (tránh nháy lỗi lúc đang stream)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    const t = setTimeout(() => setSettled(true), 1800)
    return () => clearTimeout(t)
  }, [content])

  const title = str(spec?.title)
  const view = scene ? (
    <div ref={boxRef}>
      {title && <p className="px-4 pt-3 text-sm font-semibold">{pretty(title)}</p>}
      <svg viewBox={`0 0 ${scene.w} ${scene.h}`} className="mx-auto block w-full max-w-[680px] p-2 text-foreground" role="img" aria-label={title ?? 'Đồ thị'}>
        {scene.nodes}
      </svg>
      {settled && scene.issues.length > 0 && <p className="px-4 pb-3 text-xs text-destructive">{scene.issues.slice(0, 3).join(' · ')}</p>}
    </div>
  ) : settled ? (
    <p className="p-3 text-xs font-semibold text-destructive">Không vẽ được đồ thị (JSON không hợp lệ)</p>
  ) : (
    <div className="h-40 animate-pulse bg-muted/40" />
  )

  return <FigureFrame view={view} code={code ?? <code>{content}</code>} rawCode={content} fileName="do-thi.svg" getSvg={complete ? () => serializeSvg(boxRef.current) : undefined} busy={!complete && !settled} />
}
