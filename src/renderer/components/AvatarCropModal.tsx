import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useT } from '../i18n'

const VIEW = 288 // on-screen crop viewport (px)
const OUT = 320 // exported avatar size (px)

/**
 * Circular avatar cropper. The picked image sits under a round mask; the
 * user drags to pan and zooms with the slider / mouse wheel, and we export
 * the visible square as a 320px JPEG data URL. No external deps — plain
 * canvas math (the viewport square maps back to a source rect).
 */
export function AvatarCropModal({
  file,
  onCancel,
  onSave,
}: {
  file: File
  onCancel: () => void
  onSave: (dataUrl: string) => void
}) {
  const t = useT()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1) // 1..3, multiplies the cover-fit scale
  const [offset, setOffset] = useState({ x: 0, y: 0 }) // px, viewport space
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('img')
    el.onload = () => setImg(el)
    el.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!img) return null

  // Scale so the image always covers the viewport, then apply user zoom.
  const base = VIEW / Math.min(img.naturalWidth, img.naturalHeight)
  const scale = base * zoom
  const dispW = img.naturalWidth * scale
  const dispH = img.naturalHeight * scale
  const clampOffset = (o: { x: number; y: number }, s = scale) => ({
    x: Math.max(-(img.naturalWidth * s - VIEW) / 2, Math.min((img.naturalWidth * s - VIEW) / 2, o.x)),
    y: Math.max(-(img.naturalHeight * s - VIEW) / 2, Math.min((img.naturalHeight * s - VIEW) / 2, o.y)),
  })

  const setZoomClamped = (z: number) => {
    const next = Math.max(1, Math.min(3, z))
    setZoom(next)
    setOffset((o) => clampOffset(o, base * next))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const d = drag.current
    setOffset(clampOffset({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) }))
  }
  const onPointerUp = () => { drag.current = null }
  const onWheel = (e: React.WheelEvent) => setZoomClamped(zoom + (e.deltaY < 0 ? 0.12 : -0.12))

  const save = () => {
    // The viewport square in source coordinates.
    const srcSide = VIEW / scale
    const cx = img.naturalWidth / 2 - offset.x / scale
    const cy = img.naturalHeight / 2 - offset.y / scale
    const sx = cx - srcSide / 2
    const sy = cy - srcSide / 2
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, sx, sy, srcSide, srcSide, 0, 0, OUT, OUT)
    onSave(canvas.toDataURL('image/jpeg', 0.85))
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="relative glass rounded-3xl p-6 shadow-deep flex flex-col items-center gap-5"
      >
        <div className="text-[12px] uppercase tracking-[0.2em] text-cream/60 font-semibold self-start">
          {t('cropAvatar')}
        </div>
        <div
          className="relative overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
            style={{
              width: dispW,
              height: dispH,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
          {/* Round mask preview — dim everything outside the circle. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'rgba(0,0,0,0.55)',
              WebkitMaskImage:
                'radial-gradient(circle at 50% 50%, transparent 49.5%, black 50%)',
              maskImage: 'radial-gradient(circle at 50% 50%, transparent 49.5%, black 50%)',
            }}
          />
          <div className="absolute inset-0 rounded-full border border-white/40 pointer-events-none" />
        </div>
        <div className="flex items-center gap-3 w-full px-1">
          <ZoomOut size={15} className="text-cream/50 flex-shrink-0" />
          <input
            type="range"
            min={100}
            max={300}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoomClamped(Number(e.target.value) / 100)}
            className="flex-1 accent-[rgb(var(--accent))]"
          />
          <ZoomIn size={15} className="text-cream/50 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-2 self-end">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-[13px] font-semibold transition"
          >
            <X size={14} /> {t('cancel')}
          </button>
          <button
            onClick={save}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full accent-bg text-obsidian-950 hover:brightness-110 text-[13px] font-semibold transition"
          >
            <Check size={14} /> {t('save')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
