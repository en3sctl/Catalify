import { useEffect, useRef } from 'react'

interface Drop {
  x: number
  y: number
  len: number
  speed: number
  opacity: number
  width: number
}

/**
 * Lightweight canvas rain. Low-CPU: ~60 drops, DPR-aware, one
 * requestAnimationFrame loop. Pauses when tab is hidden.
 */
export function Rain({
  intensity = 1,
  className = '',
  style,
}: {
  intensity?: number
  className?: string
  style?: React.CSSProperties
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0
    let drops: Drop[] = []

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.min(120, Math.floor((w * h) / 14000) * intensity)
      drops = Array.from({ length: count }, () => spawnDrop(w, h, true))
    }

    function spawnDrop(width: number, height: number, anywhere = false): Drop {
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -20,
        len: 12 + Math.random() * 22,
        speed: 3.5 + Math.random() * 4.5,
        opacity: 0.12 + Math.random() * 0.25,
        width: 0.6 + Math.random() * 0.8,
      }
    }

    const loop = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'
      for (const d of drops) {
        ctx.strokeStyle = `rgba(230, 225, 240, ${d.opacity})`
        ctx.lineWidth = d.width
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - d.speed * 0.1, d.y + d.len)
        ctx.stroke()
        d.y += d.speed
        if (d.y > h + d.len) Object.assign(d, spawnDrop(w, h))
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    resize()
    loop()
    window.addEventListener('resize', resize)
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current)
      } else {
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intensity])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
    />
  )
}
