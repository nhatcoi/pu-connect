'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'
import { ImageIcon, SmilePlus } from 'lucide-react'
import { useMenuPopover } from './use-menu-popover'

const PAGE_ICONS = [
  '📘', '📗', '📙', '📕', '📓', '📒', '📝', '✏️',
  '📌', '🔖', '🧠', '💡', '🔬', '🧪', '🧬', '🧮',
  '📐', '🗺️', '🌍', '🌱', '🌊', '🔥', '⭐', '✨',
  '🎯', '🎨', '🎵', '🏛️', '⚛️', '🧭', '📊', '📈',
  '🗂️', '✅', '❓', '💬', '🪐', '🦉', '🍎', '☕',
]

const PAGE_COVERS = [
  '#e6e4dc',
  '#dce5dd',
  '#dce3eb',
  '#eee0d6',
  '#e6deeb',
  '#efe6c8',
  'linear-gradient(120deg, #e8e2d4 0%, #d6e2e9 100%)',
  'linear-gradient(120deg, #f1dfd2 0%, #e5dcef 100%)',
  'linear-gradient(120deg, #d9e8dc 0%, #e8efcf 100%)',
  'linear-gradient(120deg, #dfe6f3 0%, #f1e4ec 100%)',
]

function Picker({
  open,
  setOpen,
  className,
  children,
  trigger,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  className?: string
  children: React.ReactNode
  trigger: React.ReactNode
}) {
  const root = useMenuPopover<HTMLDivElement>(open, (value) =>
    setOpen(typeof value === 'function' ? value(open) : value)
  )
  return (
    <div ref={root} className={`relative ${className ?? ''}`}>
      {trigger}
      {open && <div className="dt-popover dt-note-picker">{children}</div>}
    </div>
  )
}

export function NotePageHead({
  title,
  icon,
  cover,
  disabled = false,
  onTitle,
  onIcon,
  onCover,
}: {
  title: string
  icon?: string
  cover?: string
  disabled?: boolean
  onTitle: (title: string) => void
  onIcon?: (icon: string) => void
  onCover?: (cover: string) => void
}) {
  const [iconOpen, setIconOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [customIcon, setCustomIcon] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  const openIcons = (open: boolean) => {
    setIconOpen(open)
    if (!open) setCustomIcon('')
  }

  const pickIcon = (ic: string) => {
    openIcons(false)
    onIcon?.(ic)
  }

  const coverPicker = (trigger: React.ReactNode) => (
    <Picker open={coverOpen} setOpen={setCoverOpen} trigger={trigger}>
      <div className="dt-menu-label">Ảnh bìa / Màu nền</div>
      <div className="dt-note-cover-grid">
        {PAGE_COVERS.map((c) => (
          <button
            key={c}
            role="menuitemradio"
            aria-label={`Đặt màu nền: ${c}`}
            aria-checked={cover === c}
            style={{ background: c }}
            onClick={() => {
              setCoverOpen(false)
              onCover?.(c)
            }}
          />
        ))}
      </div>
      {cover && (
        <>
          <div className="dt-menu-divider" />
          <button
            role="menuitem"
            className="dt-menu-item is-quiet"
            onClick={() => {
              setCoverOpen(false)
              onCover?.('')
            }}
          >
            Xóa ảnh bìa
          </button>
        </>
      )}
    </Picker>
  )

  const iconPicker = (trigger: React.ReactNode, className?: string) => (
    <Picker open={iconOpen} setOpen={openIcons} trigger={trigger} className={className}>
      <div className="dt-menu-label">Biểu tượng trang</div>
      <div className="dt-note-icon-grid">
        {PAGE_ICONS.map((ic) => (
          <button
            key={ic}
            role="menuitemradio"
            aria-label={ic}
            aria-checked={icon === ic}
            onClick={() => pickIcon(ic)}
          >
            {ic}
          </button>
        ))}
      </div>
      <form
        className="dt-note-icon-custom"
        onSubmit={(e) => {
          e.preventDefault()
          if (customIcon.trim()) pickIcon(customIcon.trim())
        }}
      >
        <input
          aria-label="Nhập emoji"
          placeholder="Dán bất kỳ emoji nào…"
          maxLength={10}
          value={customIcon}
          onChange={(e) => setCustomIcon(e.target.value)}
        />
      </form>
      {icon && (
        <>
          <div className="dt-menu-divider" />
          <button role="menuitem" className="dt-menu-item is-quiet" onClick={() => pickIcon('')}>
            Xóa biểu tượng
          </button>
        </>
      )}
    </Picker>
  )

  return (
    <div className={`dt-note-head ${cover ? 'has-cover' : ''} ${icon ? 'has-icon' : ''}`}>
      {cover && (
        <div className="dt-note-cover" style={{ background: cover }}>
          <div className="dt-note-cover-actions">
            {coverPicker(
              <button
                className="dt-note-ghost"
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={coverOpen}
                onClick={() => setCoverOpen(!coverOpen)}
              >
                Đổi ảnh bìa
              </button>
            )}
          </div>
        </div>
      )}
      <div className="dt-note-head-body">
        {icon &&
          iconPicker(
            <button
              className="dt-note-page-icon"
              disabled={disabled}
              aria-label="Đổi biểu tượng"
              aria-haspopup="menu"
              aria-expanded={iconOpen}
              onClick={() => openIcons(!iconOpen)}
            >
              {icon}
            </button>,
            'dt-note-page-icon-wrap'
          )}
        <div className="dt-note-head-tools">
          {!icon &&
            iconPicker(
              <button
                className="dt-note-ghost"
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={iconOpen}
                onClick={() => openIcons(!iconOpen)}
              >
                <SmilePlus size={15} strokeWidth={1.7} />
                Add icon
              </button>
            )}
          {!cover &&
            coverPicker(
              <button
                className="dt-note-ghost"
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={coverOpen}
                onClick={() => setCoverOpen(!coverOpen)}
              >
                <ImageIcon size={15} strokeWidth={1.7} />
                Add cover
              </button>
            )}
        </div>
        <textarea
          ref={titleRef}
          rows={1}
          disabled={disabled}
          aria-label="Tiêu đề trang"
          placeholder="Untitled draft"
          className="dt-note-page-title"
          value={title}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              const editorEl = e.currentTarget
                .closest('.dt-note-document')
                ?.querySelector<HTMLElement>('.bn-editor')
              if (editorEl) editorEl.focus()
              else e.currentTarget.blur()
            }
          }}
          onChange={(e) => onTitle(e.target.value)}
        />
      </div>
    </div>
  )
}
