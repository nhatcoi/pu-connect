'use client'

import { motion } from 'motion/react'
import { PuMark } from '@/components/brand/pu-logo'

// Mạng lưới nút động: node = sinh viên/GV, cạnh = kết nối
const NODES = [
  { x: 70, y: 90, r: 7, d: 0 },
  { x: 330, y: 70, r: 9, d: 0.4 },
  { x: 60, y: 300, r: 8, d: 0.8 },
  { x: 340, y: 320, r: 7, d: 1.2 },
  { x: 200, y: 40, r: 6, d: 0.6 },
  { x: 200, y: 370, r: 6, d: 1.0 },
]
const HUB = { x: 200, y: 200 }
const CHIPS = [
  { t: '#K16 FIT', x: '4%', y: '16%', d: 0 },
  { t: 'Hỏi đáp Q&A', x: '62%', y: '8%', d: 0.5 },
  { t: 'Tài liệu', x: '2%', y: '72%', d: 1 },
  { t: 'Câu lạc bộ', x: '66%', y: '78%', d: 1.5 },
]

export function HeroNetwork() {
  return (
    <div className="relative aspect-square w-full max-w-[460px] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#0B3D91] via-[#0A3380] to-[#072A6B] shadow-2xl">
      {/* Vòng sóng lan tỏa từ hub */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={HUB.x}
            cy={HUB.y}
            fill="none"
            stroke="#F7941D"
            strokeWidth="1.5"
            initial={{ r: 40, opacity: 0.5 }}
            animate={{ r: 190, opacity: 0 }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 1.3, ease: 'easeOut' }}
          />
        ))}
        {/* Cạnh nối nét đứt chạy */}
        {NODES.map((n, i) => (
          <motion.line
            key={i}
            x1={HUB.x}
            y1={HUB.y}
            x2={n.x}
            y2={n.y}
            stroke="#fff"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 + i * 0.12 }}
            style={{ animation: 'pu-dash 1.6s linear infinite' }}
          />
        ))}
        {/* Gói dữ liệu chạy trên cạnh */}
        {NODES.map((n, i) => (
          <motion.circle
            key={`p${i}`}
            r="3"
            fill="#F7941D"
            initial={{ cx: HUB.x, cy: HUB.y, opacity: 0 }}
            animate={{ cx: [HUB.x, n.x], cy: [HUB.y, n.y], opacity: [0, 1, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: 1.5 + i * 0.5, ease: 'easeInOut' }}
          />
        ))}
        {NODES.map((n, i) => (
          <motion.circle
            key={`n${i}`}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill="#fff"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: n.d }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
        ))}
      </svg>

      {/* Hub: logo ở giữa, nổi nhẹ */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <PuMark className="h-28 w-28 drop-shadow-[0_12px_30px_rgba(10,140,240,0.35)]" />
      </motion.div>

      {/* Chip chủ đề trôi nổi */}
      {CHIPS.map((c) => (
        <motion.span
          key={c.t}
          className="absolute rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm ring-1 ring-white/25"
          style={{ left: c.x, top: c.y }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, delay: c.d, ease: 'easeInOut' }}
        >
          {c.t}
        </motion.span>
      ))}
    </div>
  )
}
