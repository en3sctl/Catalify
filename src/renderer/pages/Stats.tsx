import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Clock, Disc3, Flame, SkipForward } from 'lucide-react'
import { PlayLogEntry, getPlayLog } from '../utils/taste'
import { playSongs } from '../utils/musickit-api'
import { clsx } from '../utils/format'

type Range = '7d' | '30d' | 'all'

/**
 * Local listening stats — Çatalify's "Wrapped, all year round". Everything
 * is computed from the on-device play log (utils/taste.ts); nothing here
 * touches the network, so it loads instantly and works offline.
 */
export function Stats() {
  const [log, setLog] = useState<PlayLogEntry[]>([])
  const [range, setRange] = useState<Range>('7d')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getPlayLog().then((l) => {
      setLog(l)
      setLoaded(true)
    })
  }, [])

  const filtered = useMemo(() => {
    if (range === 'all') return log
    const cutoff = Date.now() - (range === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000
    return log.filter((e) => e.at >= cutoff)
  }, [log, range])

  const summary = useMemo(() => computeSummary(filtered), [filtered])

  return (
    <div className="pb-16">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] accent-text font-medium">
            <BarChart3 size={13} />
            <span>Your listening</span>
          </div>
          <h1 className="mt-2 text-4xl md:text-5xl font-display font-bold tracking-[-0.03em]">
            Stats
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.07] p-1">
          {(['7d', '30d', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-[12.5px] font-semibold transition',
                range === r
                  ? 'accent-bg text-obsidian-950'
                  : 'text-obsidian-300 hover:text-cream',
              )}
            >
              {r === '7d' ? 'This week' : r === '30d' ? 'This month' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {loaded && filtered.length === 0 ? (
        <p className="mt-10 text-[14px] text-obsidian-300">
          Nothing here yet — stats build up as you listen. Come back after a few songs.
        </p>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              icon={<Clock size={16} />}
              value={formatMinutes(summary.totalMs)}
              label="listened"
            />
            <StatTile
              icon={<Disc3 size={16} />}
              value={String(summary.plays)}
              label={summary.plays === 1 ? 'play' : 'plays'}
            />
            <StatTile
              icon={<Flame size={16} />}
              value={String(summary.uniqueArtists)}
              label="different artists"
            />
            <StatTile
              icon={<SkipForward size={16} />}
              value={`${summary.skipRate}%`}
              label="skip rate"
            />
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Top artists */}
            <section>
              <h2 className="font-display text-[20px] font-bold tracking-tight mb-4">
                Top artists
              </h2>
              <RankList
                rows={summary.topArtists.map((a) => ({
                  key: a.name,
                  title: a.name,
                  detail: formatMinutes(a.ms),
                  frac: summary.topArtists[0] ? a.ms / summary.topArtists[0].ms : 0,
                }))}
              />
            </section>

            {/* Top songs */}
            <section>
              <h2 className="font-display text-[20px] font-bold tracking-tight mb-4">
                Top songs
              </h2>
              <RankList
                rows={summary.topSongs.map((s) => ({
                  key: s.id,
                  title: s.title,
                  subtitle: s.artist,
                  detail: `${s.plays}×`,
                  frac: summary.topSongs[0] ? s.plays / summary.topSongs[0].plays : 0,
                  onClick: /^i\./i.test(s.id)
                    ? undefined
                    : () => playSongs([s.id]).catch(console.error),
                }))}
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

/* ── computation ───────────────────────────────────────────── */

function computeSummary(entries: PlayLogEntry[]) {
  let totalMs = 0
  let skips = 0
  const byArtist = new Map<string, number>()
  const bySong = new Map<string, { id: string; title: string; artist: string; plays: number; ms: number }>()
  for (const e of entries) {
    totalMs += e.ms
    if (e.ms < 30_000 && e.ms < e.d * 0.5) skips++
    if (e.a) byArtist.set(e.a, (byArtist.get(e.a) ?? 0) + e.ms)
    const s = bySong.get(e.id) ?? { id: e.id, title: e.t || 'Unknown', artist: e.a, plays: 0, ms: 0 }
    s.plays += 1
    s.ms += e.ms
    bySong.set(e.id, s)
  }
  return {
    totalMs,
    plays: entries.length,
    uniqueArtists: byArtist.size,
    skipRate: entries.length ? Math.round((100 * skips) / entries.length) : 0,
    topArtists: [...byArtist.entries()]
      .map(([name, ms]) => ({ name, ms }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 10),
    topSongs: [...bySong.values()]
      .sort((a, b) => b.plays - a.plays || b.ms - a.ms)
      .slice(0, 10),
  }
}

function formatMinutes(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/* ── presentation ──────────────────────────────────────────── */

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl liquid-glass p-4">
      <div className="accent-text">{icon}</div>
      <div className="mt-2 text-[26px] font-display font-bold tracking-tight text-cream leading-none">
        {value}
      </div>
      <div className="mt-1 text-[12px] text-obsidian-300">{label}</div>
    </div>
  )
}

function RankList({
  rows,
}: {
  rows: Array<{
    key: string
    title: string
    subtitle?: string
    detail: string
    frac: number
    onClick?: () => void
  }>
}) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => {
        const Row = r.onClick ? 'button' : 'div'
        return (
          <Row
            key={r.key}
            onClick={r.onClick}
            className={clsx(
              'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left overflow-hidden',
              r.onClick && 'hover:bg-white/[0.05] transition cursor-pointer',
            )}
          >
            {/* Proportional bar behind the row — reads as a chart without being one. */}
            <div
              aria-hidden
              className="absolute inset-y-1 left-0 rounded-lg"
              style={{
                width: `${Math.max(4, r.frac * 100)}%`,
                background: 'rgb(var(--accent) / 0.09)',
              }}
            />
            <span className="relative w-6 text-[13px] font-semibold text-obsidian-400 flex-shrink-0 tabular-nums">
              {i + 1}
            </span>
            <span className="relative flex-1 min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-cream">{r.title}</span>
              {r.subtitle && (
                <span className="block truncate text-[11.5px] text-obsidian-400">{r.subtitle}</span>
              )}
            </span>
            <span className="relative text-[12px] text-obsidian-300 flex-shrink-0 tabular-nums">
              {r.detail}
            </span>
          </Row>
        )
      })}
    </div>
  )
}
