import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer } from '../store/player'
import { fetchLyrics, LyricLine, LyricsResult } from '../utils/lyrics'
import { useSmoothProgress } from '../hooks/useSmoothProgress'
import { clsx } from '../utils/format'

/**
 * Time-synced lyrics view with a karaoke-style per-word read head. Drops
 * into either the standalone /lyrics route or the Now Playing "show lyrics"
 * side panel — same rendering either way.
 *
 * Props kept minimal (`compact` just dials down font sizes for the panel
 * variant). The panel pulls track metadata from the player store directly.
 */
export function LyricsPanel({ compact = false }: { compact?: boolean }) {
  const np = usePlayer((s) => s.nowPlaying)
  const progressMs = usePlayer((s) => s.progressMs)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const seek = usePlayer((s) => s.seek)
  const smoothProgressMs = useSmoothProgress(progressMs, isPlaying)

  const [result, setResult] = useState<LyricsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!np) return
    setResult(null)
    setLoading(true)
    fetchLyrics({
      title: np.title,
      artistName: np.artistName,
      albumName: np.albumName,
      durationMs: np.durationMs,
      appleSongId: np.id,
    })
      .then((r) => setResult(r))
      .finally(() => setLoading(false))
  }, [np?.id])

  const lines = result?.lines ?? null
  const isSynced = !!result?.synced

  const activeIdx = useMemo(() => {
    if (!lines || !isSynced) return -1
    let idx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timeMs <= smoothProgressMs) idx = i
      else break
    }
    return idx
  }, [lines, smoothProgressMs, isSynced])

  const charsPerMs = useMemo(() => {
    const FALLBACK = 0.016
    if (!lines || lines.length < 2) return FALLBACK
    const rates: number[] = []
    for (let i = 0; i < lines.length - 1; i++) {
      const c = lines[i].text.replace(/\s+/g, '').length
      const gap = lines[i + 1].timeMs - lines[i].timeMs
      if (gap > 400 && gap < 7000 && c > 2) rates.push(c / gap)
    }
    if (rates.length === 0) return FALLBACK
    rates.sort((a, b) => a - b)
    const p75 = rates[Math.min(rates.length - 1, Math.floor(rates.length * 0.75))]
    return Math.max(0.012, p75)
  }, [lines])

  useEffect(() => {
    if (activeIdx < 0) return
    const container = containerRef.current
    const el = lineRefs.current[activeIdx]
    if (!container || !el) return
    // Manual scrollTo (not scrollIntoView) so we can centre within the
    // lyrics panel's viewport without the browser walking up ancestor
    // scrollables. scrollIntoView used to tug on `main` when the line
    // size changed, which was part of the "lyrics push the page up" feel.
    const target = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [activeIdx])

  if (!np) {
    return (
      <div className="h-full flex items-center justify-center text-obsidian-400 italic">
        Play something to see lyrics.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto overflow-x-hidden py-16 px-4"
      style={{
        // Fixed-pixel fades (rather than percentages) so a tall panel
        // doesn't suddenly grow a 100 px dark band at the bottom that
        // reads as a UI element. 32 px is enough to soften the edge.
        mask: 'linear-gradient(transparent 0, black 32px, black calc(100% - 32px), transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(transparent 0, black 32px, black calc(100% - 32px), transparent 100%)',
      }}
    >
      {loading && <div className="text-center text-obsidian-400 italic">Loading lyrics…</div>}
      {!loading && !lines && (
        <div className="text-center text-obsidian-400 italic max-w-md mx-auto">
          No lyrics found on lrclib or Apple Music for this track.
        </div>
      )}
      {lines && lines.length === 0 && (
        <div className="text-center text-obsidian-400 italic">No lyrics found.</div>
      )}
      {lines && lines.length > 0 && (
        <div className={clsx('mx-auto space-y-4', compact ? 'max-w-md' : 'max-w-2xl')}>
          {!isSynced && (
            <div className="text-center text-obsidian-500 text-[10px] uppercase tracking-widest mb-6">
              Unsynced lyrics
            </div>
          )}
          {lines.map((line, i) => {
            const state =
              !isSynced ? 'flat' : i === activeIdx ? 'active' : i < activeIdx ? 'past' : 'future'
            return (
              <LyricsLine
                key={i}
                setRef={(el) => { lineRefs.current[i] = el }}
                line={line}
                nextTimeMs={lines[i + 1]?.timeMs}
                progressMs={smoothProgressMs}
                charsPerMs={charsPerMs}
                state={state}
                compact={compact}
                onClick={isSynced ? () => seek(line.timeMs) : undefined}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

interface Token {
  kind: 'word' | 'space'
  text: string
  start: number
  end: number
}

function splitTokens(text: string): { tokens: Token[]; totalChars: number } {
  const out: Token[] = []
  const re = /(\s+)|(\S+)/g
  let match: RegExpExecArray | null
  let cursor = 0
  while ((match = re.exec(text)) !== null) {
    if (match[1]) {
      out.push({ kind: 'space', text: match[1], start: cursor, end: cursor })
    } else {
      const word = match[2]
      out.push({ kind: 'word', text: word, start: cursor, end: cursor + word.length })
      cursor += word.length
    }
  }
  return { tokens: out, totalChars: Math.max(1, cursor) }
}

const WordToken = ({
  token,
  totalChars,
  lineFillRatio,
}: {
  token: Token
  totalChars: number
  lineFillRatio: number
}) => {
  const wordStart = token.start / totalChars
  const wordEnd = token.end / totalChars
  const soft = 0.08
  const wordRatio = Math.min(
    1,
    Math.max(0, (lineFillRatio - wordStart) / Math.max(0.0001, (wordEnd - wordStart) + soft)),
  )
  const opacity = 0.25 + 0.75 * wordRatio
  return (
    <span
      style={{
        color: `rgba(255, 255, 255, ${opacity.toFixed(3)})`,
        transition: 'color 120ms linear',
      }}
    >
      {token.text}
    </span>
  )
}

type LineState = 'flat' | 'past' | 'active' | 'future'

interface LyricsLineProps {
  line: LyricLine
  nextTimeMs: number | undefined
  progressMs: number
  charsPerMs: number
  state: LineState
  onClick: (() => void) | undefined
  setRef: (el: HTMLDivElement | null) => void
  compact?: boolean
}

const LyricsLine = ({
  setRef,
  line,
  nextTimeMs,
  progressMs,
  charsPerMs,
  state,
  onClick,
  compact,
}: LyricsLineProps) => {
  const fillRatio = useMemo(() => {
    if (state !== 'active') return state === 'past' ? 1 : 0
    const charCount = line.text.replace(/\s+/g, '').length
    const estimatedMs = Math.max(400, charCount / Math.max(0.004, charsPerMs))
    const gapMs = nextTimeMs ? nextTimeMs - line.timeMs : estimatedMs + 400
    const effectiveDur = Math.max(400, Math.min(estimatedMs, gapMs - 50))
    const elapsed = progressMs - line.timeMs
    return Math.min(1, Math.max(0, elapsed / effectiveDur))
  }, [state, nextTimeMs, progressMs, line.timeMs, line.text, charsPerMs])

  // Single base size for every line keeps layout stable line-to-line —
  // the "emphasis" on the active line is done with `transform: scale`
  // instead of font-size swapping, so the block above never shifts when
  // a line changes state. That's the fix for the karaoke "jump" feel.
  const baseSize = compact
    ? 'text-xl md:text-2xl'
    : 'text-3xl md:text-4xl'

  const lineTransition =
    'transition-[opacity,transform,color,filter,text-shadow] duration-[380ms] ease-out will-change-[transform,opacity]'

  if (state === 'active') {
    const { tokens, totalChars } = splitTokens(line.text)
    return (
      <div
        ref={setRef}
        onClick={onClick}
        className={clsx(
          'text-center leading-[1.15] tracking-tight font-sans cursor-pointer select-none font-semibold',
          baseSize,
          lineTransition,
        )}
        style={{
          transform: 'scale(1.08)',
          opacity: 1,
          textShadow: `0 0 45px rgb(var(--accent) / 0.35)`,
        }}
      >
        {tokens.map((tok, idx) =>
          tok.kind === 'space' ? (
            <span key={idx}> </span>
          ) : (
            <WordToken key={idx} token={tok} totalChars={totalChars} lineFillRatio={fillRatio} />
          ),
        )}
      </div>
    )
  }

  const stateColor =
    state === 'past' ? 'rgba(255,255,255,0.32)'
    : state === 'flat' ? 'rgba(255,255,255,0.82)'
    : 'rgba(255,255,255,0.58)'

  const stateOpacity = state === 'past' ? 0.55 : state === 'future' ? 0.85 : 1
  const stateScale = state === 'past' ? 0.96 : state === 'future' ? 0.97 : 1

  return (
    <div
      ref={setRef}
      onClick={onClick}
      className={clsx(
        'text-center leading-[1.15] tracking-tight font-sans select-none font-medium',
        baseSize,
        lineTransition,
        onClick && 'cursor-pointer hover:text-white/90',
      )}
      style={{
        color: stateColor,
        opacity: stateOpacity,
        transform: `scale(${stateScale})`,
      }}
    >
      {line.text}
    </div>
  )
}
