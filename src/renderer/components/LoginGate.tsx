import { motion } from 'framer-motion'
import { usePlayer } from '../store/player'
import { authorize } from '../utils/musickit-api'

export function LoginGate({ children }: { children: React.ReactNode }) {
  const isAuthorized = usePlayer((s) => s.isAuthorized)
  const isReady = usePlayer((s) => s.isReady)

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-obsidian-400 border-t-transparent animate-spin" />
        <p className="text-obsidian-300 text-sm">Loading MusicKit…</p>
      </div>
    )
  }

  if (!isAuthorized) return <WelcomeScreen />

  return <>{children}</>
}

function WelcomeScreen() {
  const handleSignIn = () => {
    authorize().catch((e) => {
      console.error('Auth error:', e)
      import('../store/toast').then((m) =>
        m.toast.error('Auth Error', String(e.message || e)),
      )
    })
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Subtle paper-like noise/texture so the black never feels flat.
          Layered here (not via `.noise::before`) so it's scoped to this
          screen and doesn't depend on the global shell. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.8'/></svg>\")",
        }}
      />

      <div className="relative h-full w-full grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] items-stretch">
        {/* ── LEFT: typography-first manifesto ── */}
        <div className="flex flex-col justify-between px-10 md:px-16 py-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 text-[12px] text-obsidian-400 tracking-widest uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span>Çatalify · v0.1.0</span>
          </motion.div>

          <div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[84px] md:text-[124px] font-extrabold leading-[0.88] tracking-[-0.045em] text-cream"
            >
              The sound<br />
              <span className="text-obsidian-300">you</span>{' '}
              <span className="relative">
                own
                <span
                  aria-hidden
                  className="absolute left-0 -bottom-2 h-[10px] w-full rounded-sm"
                  style={{ background: 'rgb(var(--accent))' }}
                />
              </span>
              .
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.7 }}
              className="mt-8 max-w-[460px] text-obsidian-300 text-[15px] leading-relaxed"
            >
              A personal Apple Music player. Full catalog, synced lyrics,
              Discord presence, global media keys — no bloat, no ads,
              everything runs on your machine.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="mt-12 flex items-center gap-4 flex-wrap"
            >
              <button
                onClick={handleSignIn}
                className="group relative inline-flex items-center gap-3 px-6 py-3.5 bg-cream text-obsidian-950 font-semibold text-[14px] tracking-tight rounded-md hover:bg-white transition overflow-hidden"
              >
                <AppleIcon />
                <span>Sign in with Apple Music</span>
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
                  style={{
                    background:
                      'linear-gradient(100deg, transparent 30%, rgba(255,180,100,0.35) 50%, transparent 70%)',
                  }}
                />
              </button>
              <span className="text-[12px] text-obsidian-400">
                Requires an active subscription.
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex items-center gap-6 text-[11px] text-obsidian-500 tracking-wide uppercase"
          >
            <FootNote label="Lyrics" />
            <FootNote label="Media keys" />
            <FootNote label="Discord RPC" />
            <FootNote label="Mini-player" />
          </motion.div>
        </div>

        {/* ── RIGHT: static cover wall (not decorative garbage — each
            tile is a hand-tuned gradient + pattern, subtle hover tilt) ── */}
        <div className="relative hidden lg:block overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-[1px] w-40 z-10"
            style={{
              background:
                'linear-gradient(90deg, rgb(10 8 18) 0%, transparent 100%)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 grid grid-cols-3 grid-rows-4 gap-3 p-6"
            style={{ transform: 'rotate(-5deg) scale(1.18)' }}
          >
            {COVER_TILES.map((tile, i) => (
              <CoverTile key={i} tile={tile} delay={0.1 + i * 0.035} />
            ))}
          </motion.div>
          {/* Vignette: fade edges so the mosaic reads as "on a wall" */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 70% 50%, transparent 35%, rgb(10 8 18) 95%)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function FootNote({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-4 h-[1px] bg-obsidian-600" />
      {label}
    </span>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

/* ── Cover wall ───────────────────────────────────────────────── */

interface Tile {
  // Gradient stops
  a: string
  b: string
  // Decorative pattern
  pattern: 'bars' | 'circle' | 'grid' | 'diagonal' | 'blob' | 'solid'
  // Accent dot (simulated pressed-vinyl center)
  dot?: string
  // Optional oversized character for that "album title letter" feel
  glyph?: string
  // Span info for collage layout
  col?: number
  row?: number
}

const COVER_TILES: Tile[] = [
  { a: '#1f1f2f', b: '#0f0f1b', pattern: 'bars', glyph: 'Ç', col: 1, row: 2 },
  { a: '#c9502a', b: '#7a2012', pattern: 'solid', glyph: '♪' },
  { a: '#2b4a5e', b: '#0f1e2a', pattern: 'grid' },
  { a: '#ffb86b', b: '#b05a18', pattern: 'circle', dot: '#0a0812' },
  { a: '#5c4a3c', b: '#1a1410', pattern: 'diagonal', glyph: 'M' },
  { a: '#9c8f6b', b: '#443820', pattern: 'solid' },
  { a: '#3a2a4a', b: '#120820', pattern: 'blob' },
  { a: '#a23b5a', b: '#43121f', pattern: 'solid', glyph: '8' },
  { a: '#c2b280', b: '#504822', pattern: 'diagonal' },
  { a: '#1a3a2e', b: '#071a13', pattern: 'grid', glyph: 'Ä' },
  { a: '#d4864a', b: '#6b3514', pattern: 'bars' },
  { a: '#2a2030', b: '#0d0814', pattern: 'circle', dot: '#d4864a' },
]

function CoverTile({ tile, delay }: { tile: Tile; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.04, rotate: 0, zIndex: 10 }}
      className="relative rounded-[10px] overflow-hidden shadow-[0_18px_40px_-14px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04]"
      style={{
        background: `linear-gradient(135deg, ${tile.a}, ${tile.b})`,
      }}
    >
      <Pattern kind={tile.pattern} dot={tile.dot} />
      {tile.glyph && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display font-extrabold text-white/70 mix-blend-overlay"
            style={{ fontSize: 'clamp(48px, 8vw, 120px)', letterSpacing: '-0.05em' }}
          >
            {tile.glyph}
          </span>
        </div>
      )}
    </motion.div>
  )
}

function Pattern({ kind, dot }: { kind: Tile['pattern']; dot?: string }) {
  switch (kind) {
    case 'bars':
      return (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.2) 0 2px, transparent 2px 12px)',
          }}
        />
      )
    case 'circle':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[60%] aspect-square rounded-full border-[14px] border-white/10" />
          {dot && (
            <span
              className="absolute w-[18%] aspect-square rounded-full"
              style={{ background: dot }}
            />
          )}
        </div>
      )
    case 'grid':
      return (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
      )
    case 'diagonal':
      return (
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, rgba(255,255,255,0.15) 0 2px, transparent 2px 14px)',
          }}
        />
      )
    case 'blob':
      return (
        <div
          className="absolute -inset-4"
          style={{
            background:
              'radial-gradient(50% 50% at 30% 70%, rgba(255,255,255,0.22), transparent 60%)',
          }}
        />
      )
    case 'solid':
    default:
      return null
  }
}
