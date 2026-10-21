'use client'

import React, { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { barButton, FloatingBar, Stage, ZoomControls } from './viewer-parts'

// Ảnh: vừa khung, phóng to (cuộn để kéo), xoay 90° (ảnh chụp bảng / vở hay bị ngược)
export default function ImageView({ url, name }: { url: string; name: string }) {
  const [zoom, setZoom] = useState(1)
  const [turns, setTurns] = useState(0)
  return (
    <Stage
      className="grid place-items-center p-4"
      bar={
        <FloatingBar>
          <ZoomControls zoom={zoom} min={0.5} max={4} step={0.5} onChange={setZoom} />
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" className={barButton} onClick={() => setTurns((t) => (t + 1) % 4)} aria-label="Xoay ảnh">
            <RotateCw className="h-4 w-4" />
          </button>
        </FloatingBar>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name}
        style={zoom === 1 ? { transform: `rotate(${turns * 90}deg)` } : { width: `${zoom * 100}%`, maxWidth: 'none', transform: `rotate(${turns * 90}deg)` }}
        className="max-h-full max-w-full rounded-lg object-contain shadow-sm transition-transform"
      />
    </Stage>
  )
}
