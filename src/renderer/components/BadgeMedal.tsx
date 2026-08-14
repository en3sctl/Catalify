import { useState } from 'react'
import { clsx } from '../utils/format'
import { BadgeDef } from '../utils/badges'
import { useT } from '../i18n'

/**
 * A listening badge rendered as a proper medal: an SVG seal (scalloped
 * circle / shield / hex / starburst / ribbon / ring) with a per-badge hue
 * gradient and the emoji embossed on top. Clicking flips the card in 3D to
 * reveal how the badge is earned on the back (flip CSS in globals.css).
 *
 * `locked` renders a desaturated silhouette — still flippable, so the
 * back doubles as the "how to unlock" hint.
 */
export function BadgeMedal({
  def,
  size = 96,
  locked = false,
  dimmed = false,
  corner,
}: {
  def: BadgeDef
  size?: number
  /** Not yet earned — gray silhouette, still flippable. */
  locked?: boolean
  /** Earned but hidden from the public profile (own-profile state). */
  dimmed?: boolean
  /** Optional small control rendered over the top-right corner (e.g. eye toggle). */
  corner?: React.ReactNode
}) {
  const t = useT()
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: size }}>
      <div className="relative">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="flip-wrap block outline-none"
          style={{ width: size, height: size }}
          aria-label={`${t(def.nameKey)} — ${t(def.descKey)}`}
        >
          <div className={clsx('flip-inner', flipped && 'flipped')}>
            {/* Front — the medal itself */}
            <div
              className={clsx(
                'flip-face flex items-center justify-center transition-opacity',
                locked && 'grayscale opacity-40',
                !locked && dimmed && 'opacity-50 saturate-50',
              )}
            >
              <MedalShape def={def} locked={locked} />
              <span
                className="absolute pointer-events-none select-none"
                style={{
                  fontSize: size * 0.34,
                  // Ribbon medals carry a banner at the bottom — lift the
                  // emoji so it sits in the circular part of the seal.
                  transform: def.shape === 'ribbon' ? 'translateY(-12%)' : undefined,
                  filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
                }}
              >
                {locked ? '🔒' : def.emoji}
              </span>
            </div>
            {/* Back — how it's earned. Font auto-shrinks with text length
                so long descriptions stay inside the medal silhouette. */}
            <div className="flip-face flip-back flex items-center justify-center">
              <MedalShape def={def} locked back />
              <span
                className="absolute text-center font-semibold leading-snug text-white pointer-events-none select-none"
                style={{
                  fontSize: Math.max(
                    8,
                    size * (t(def.descKey).length > 55 ? 0.082 : t(def.descKey).length > 32 ? 0.094 : 0.11),
                  ),
                  maxWidth: size * 0.7,
                  transform: def.shape === 'ribbon' ? 'translateY(-10%)' : undefined,
                }}
              >
                {t(def.descKey)}
              </span>
            </div>
          </div>
        </button>
        {corner && <div className="absolute -top-1 -right-1 z-[1]">{corner}</div>}
      </div>
      <div
        className={clsx(
          'text-[11px] font-semibold text-center leading-tight',
          locked ? 'text-cream/40' : dimmed ? 'text-cream/50' : 'text-cream/90',
        )}
      >
        {t(def.nameKey)}
      </div>
    </div>
  )
}

/* ── SVG medal shapes ─────────────────────────────────────────── */

function polyPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (Math.PI * i) / n
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

function regularPoints(cx: number, cy: number, r: number, n: number): string {
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

function MedalShape({ def, locked = false, back = false }: { def: BadgeDef; locked?: boolean; back?: boolean }) {
  const gid = `medal-${def.id}${back ? '-b' : ''}`
  const h = def.hue
  // Deliberately desaturated "aged metal" palette — the hue only tints the
  // gray so medals read as one family and don't fight the app theme.
  // Back face is darker/flatter so white text reads on it.
  const c1 = back ? `hsl(${h} 12% 28%)` : `hsl(${h} 22% 52%)`
  const c2 = back ? `hsl(${h} 12% 19%)` : `hsl(${h} 24% 33%)`
  const stroke = back ? `hsl(${h} 10% 40%)` : `hsl(${h} 18% 21%)`
  const shine = 'rgba(255,255,255,0.3)'

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      {def.shape === 'seal' && (
        <polygon points={polyPoints(50, 50, 47, 42, 22)} fill={`url(#${gid})`} stroke={stroke} strokeWidth="2" />
      )}
      {def.shape === 'burst' && (
        <polygon points={polyPoints(50, 50, 48, 34, 12)} fill={`url(#${gid})`} stroke={stroke} strokeWidth="2" />
      )}
      {def.shape === 'hex' && (
        <polygon points={regularPoints(50, 50, 46, 6)} fill={`url(#${gid})`} stroke={stroke} strokeWidth="2.5" />
      )}
      {def.shape === 'shield' && (
        <path
          d="M50 4 L86 17 V48 C86 72 69 89 50 96 C31 89 14 72 14 48 V17 Z"
          fill={`url(#${gid})`}
          stroke={stroke}
          strokeWidth="2.5"
        />
      )}
      {def.shape === 'ring' && (
        <>
          <circle cx="50" cy="50" r="45" fill={`url(#${gid})`} stroke={stroke} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="35" fill="none" stroke={shine} strokeWidth="1.5" opacity="0.6" />
        </>
      )}
      {def.shape === 'ribbon' && (
        <>
          {/* Banner behind the seal, notched ends */}
          <path
            d="M8 62 H92 L84 73 L92 84 H8 L16 73 Z"
            fill={c2}
            stroke={stroke}
            strokeWidth="2"
          />
          <polygon points={polyPoints(50, 42, 38, 34, 20)} fill={`url(#${gid})`} stroke={stroke} strokeWidth="2" />
        </>
      )}
      {/* Inner ring + specular highlight give the "stamped metal" read. */}
      {def.shape !== 'ring' && def.shape !== 'ribbon' && (
        <circle cx="50" cy="50" r={def.shape === 'burst' ? 28 : 34} fill="none" stroke={shine} strokeWidth="1.5" opacity={back ? 0.25 : 0.55} />
      )}
      {!back && !locked && (
        <ellipse cx="38" cy="30" rx="22" ry="12" fill="white" opacity="0.14" transform="rotate(-24 38 30)" />
      )}
    </svg>
  )
}
