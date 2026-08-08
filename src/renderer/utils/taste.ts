/**
 * Local taste model — the "does Çatalify know me?" layer.
 *
 * Spotify-grade recommendations rest on three legs: collaborative
 * filtering, audio embeddings, and behaviour signals. The first two need
 * server-side data we'll never have; this module is the third leg, done
 * entirely locally:
 *
 *   - Every finished/skipped track updates a per-artist affinity score
 *     (skip before 30s = negative, near-complete listen = positive —
 *     the same weighting Apple/Spotify use for their own signals).
 *   - `scoreCandidate` ranks radio-continuation candidates using that
 *     affinity + a Love boost + a *soft* recency penalty (recently played
 *     songs sink to the bottom instead of being hard-banned, so a thin
 *     pool degrades to "play yesterday's songs" instead of "fall back to
 *     MusicKit's blind autoplay").
 *
 * Persisted under electron-store key `tasteStats`. Artist names (not ids)
 * are the key because that's the one field every candidate shape carries.
 */

interface ArtistStat {
  /** Accumulated positive signal (completions, mild credit for partials). */
  pos: number
  /** Accumulated negative signal (early skips). */
  neg: number
  /** Last update, ms epoch — used only for pruning. */
  at: number
}

interface TasteStats {
  artists: Record<string, ArtistStat>
}

const MAX_ARTISTS = 500
const SKIP_THRESHOLD_MS = 30_000
const COMPLETE_RATIO = 0.85
// How much a just-played track is penalised; decays linearly to 0 over 24h.
const RECENCY_PENALTY = 6
const RECENCY_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * One row per finished/abandoned listen — the raw material for the Stats
 * page (and, come December, a local "Çatalify Wrapped"). Compact keys on
 * purpose: this array lives in electron-store JSON.
 */
export interface PlayLogEntry {
  /** Catalog song id. */
  id: string
  /** Title. */
  t: string
  /** Artist name. */
  a: string
  /** Milliseconds actually listened. */
  ms: number
  /** Track duration ms. */
  d: number
  /** Ms epoch when the listen ended. */
  at: number
}

const MAX_LOG_ENTRIES = 4000

let stats: TasteStats = { artists: {} }
let playLog: PlayLogEntry[] = []
let loaded = false
let persistTimer: number | null = null
let logPersistTimer: number | null = null

export async function loadTasteStats(): Promise<void> {
  if (loaded) return
  try {
    const raw = await window.bombo.store.get<TasteStats>('tasteStats')
    if (raw && typeof raw === 'object' && raw.artists) stats = raw
  } catch {}
  try {
    const rawLog = await window.bombo.store.get<PlayLogEntry[]>('playLog')
    if (Array.isArray(rawLog)) playLog = rawLog
  } catch {}
  loaded = true
}

/** The full local listen history, newest last. Loads if not yet loaded. */
export async function getPlayLog(): Promise<PlayLogEntry[]> {
  await loadTasteStats()
  return playLog
}

/** Debounced persist — outcomes arrive at most once per track change. */
function persist() {
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    window.bombo.store.set('tasteStats', stats)
  }, 1500)
}

function prune() {
  const names = Object.keys(stats.artists)
  if (names.length <= MAX_ARTISTS) return
  names
    .sort((a, b) => {
      const sa = stats.artists[a], sb = stats.artists[b]
      // Drop the least-informative, oldest entries first.
      return (sa.pos + sa.neg) - (sb.pos + sb.neg) || sa.at - sb.at
    })
    .slice(0, names.length - MAX_ARTISTS)
    .forEach((n) => delete stats.artists[n])
}

/**
 * Record how a listen ended. Call when the now-playing track changes (or
 * playback stops), with how far the *previous* track got. Updates both
 * the artist-affinity model and the raw play log for Stats.
 */
export function recordListenOutcome(listen: {
  id: string
  title?: string
  artistName?: string
  progressMs: number
  durationMs: number
}): void {
  const { id, title, artistName, progressMs, durationMs } = listen
  // Log every listen ≥5s — Stats wants partials too (skip-rate metric).
  if (id && durationMs > 0 && progressMs >= 5_000) {
    playLog.push({
      id,
      t: title ?? '',
      a: artistName ?? '',
      ms: Math.min(progressMs, durationMs),
      d: durationMs,
      at: Date.now(),
    })
    if (playLog.length > MAX_LOG_ENTRIES) playLog = playLog.slice(-MAX_LOG_ENTRIES)
    if (logPersistTimer) window.clearTimeout(logPersistTimer)
    logPersistTimer = window.setTimeout(() => {
      window.bombo.store.set('playLog', playLog)
    }, 2000)
  }

  if (!artistName || !durationMs || durationMs < 40_000) return
  const key = artistName.trim()
  if (!key) return
  const s = stats.artists[key] ?? { pos: 0, neg: 0, at: 0 }
  if (progressMs < SKIP_THRESHOLD_MS && progressMs < durationMs * 0.5) {
    s.neg += 1
  } else if (progressMs >= durationMs * COMPLETE_RATIO) {
    s.pos += 1
  } else {
    // Partial listen past 30s — weak positive; they didn't reject it.
    s.pos += 0.25
  }
  s.at = Date.now()
  stats.artists[key] = s
  prune()
  persist()
}

/** Net artist affinity, clamped to [-4, +4] so one artist can't dominate. */
export function artistAffinity(artistName: string | undefined): number {
  if (!artistName) return 0
  const s = stats.artists[artistName.trim()]
  if (!s) return 0
  return Math.max(-4, Math.min(4, s.pos - 1.5 * s.neg))
}

export interface CandidateContext {
  /** Loved-song ids (usePlayer.likedIds). Strongest positive signal. */
  likedIds: Record<string, boolean>
  /** id → lastPlayedAt ms (usePlayer.recentPlays). Soft recency penalty. */
  recentPlays: Record<string, number>
  now?: number
}

/**
 * Score one continuation candidate. Higher = better. Deliberately simple
 * and inspectable — a linear blend of the signals we actually trust.
 */
export function scoreCandidate(
  c: { id: string; artistName?: string; fromPersonalMix?: boolean },
  ctx: CandidateContext,
): number {
  const now = ctx.now ?? Date.now()
  let score = 0
  // Love = the user's explicit "more of this".
  if (ctx.likedIds[c.id]) score += 2.5
  // Behavioural affinity for the artist (skips push below zero).
  score += artistAffinity(c.artistName) * 0.5
  // Candidates sourced from Apple's personal mixes carry Apple's
  // account-level collaborative filtering — worth a nudge over the
  // generic similar-artist pool.
  if (c.fromPersonalMix) score += 0.75
  // Soft recency: played 1h ago ≈ -5.75, 12h ≈ -3, 24h+ ≈ 0. Sinks
  // recent repeats to the bottom without banning them outright.
  const playedAt = ctx.recentPlays[c.id]
  if (playedAt && now - playedAt < RECENCY_WINDOW_MS) {
    score -= RECENCY_PENALTY * (1 - (now - playedAt) / RECENCY_WINDOW_MS)
  }
  // Jitter so equal-scored candidates don't always land in fetch order.
  score += Math.random() * 0.5
  return score
}
