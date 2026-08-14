import { PlayLogEntry } from './taste'
import { TKey } from '../i18n'

/**
 * Listening badges — computed locally from the playLog (the same log the
 * Stats page reads), then the *displayed* set is synced to the social
 * backend as an array of ids so friends see them on the profile header.
 *
 * Rendering always resolves ids against BADGE_DEFS locally — unknown ids
 * from newer app versions are silently skipped. Each def carries a medal
 * shape + hue used by components/BadgeMedal.tsx to draw the SVG seal.
 */
export type BadgeShape = 'seal' | 'shield' | 'hex' | 'burst' | 'ribbon' | 'ring'

export interface BadgeDef {
  id: string
  emoji: string
  nameKey: TKey
  descKey: TKey
  shape: BadgeShape
  /** HSL hue for the medal's gradient. */
  hue: number
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'h10', emoji: '🎧', nameKey: 'badgeH10', descKey: 'badgeH10Desc', shape: 'seal', hue: 210 },
  { id: 'h50', emoji: '🔥', nameKey: 'badgeH50', descKey: 'badgeH50Desc', shape: 'shield', hue: 25 },
  { id: 'h100', emoji: '🌌', nameKey: 'badgeH100', descKey: 'badgeH100Desc', shape: 'burst', hue: 275 },
  { id: 'explorer', emoji: '🧭', nameKey: 'badgeExplorer', descKey: 'badgeExplorerDesc', shape: 'ribbon', hue: 150 },
  { id: 'superfan', emoji: '💘', nameKey: 'badgeSuperfan', descKey: 'badgeSuperfanDesc', shape: 'seal', hue: 340 },
  { id: 'nightowl', emoji: '🦉', nameKey: 'badgeNightowl', descKey: 'badgeNightowlDesc', shape: 'hex', hue: 250 },
  { id: 'earlybird', emoji: '🐦', nameKey: 'badgeEarlybird', descKey: 'badgeEarlybirdDesc', shape: 'ring', hue: 45 },
  { id: 'finisher', emoji: '✅', nameKey: 'badgeFinisher', descKey: 'badgeFinisherDesc', shape: 'shield', hue: 160 },
  { id: 'streak7', emoji: '📅', nameKey: 'badgeStreak7', descKey: 'badgeStreak7Desc', shape: 'ribbon', hue: 0 },
  { id: 'regular500', emoji: '🎶', nameKey: 'badgeRegular', descKey: 'badgeRegularDesc', shape: 'hex', hue: 200 },
  { id: 'repeat25', emoji: '🔁', nameKey: 'badgeRepeat', descKey: 'badgeRepeatDesc', shape: 'seal', hue: 300 },
  { id: 'marathon', emoji: '🏃', nameKey: 'badgeMarathon', descKey: 'badgeMarathonDesc', shape: 'burst', hue: 15 },
  { id: 'weekend', emoji: '🎉', nameKey: 'badgeWeekend', descKey: 'badgeWeekendDesc', shape: 'ribbon', hue: 330 },
  { id: 'collector', emoji: '💿', nameKey: 'badgeCollector', descKey: 'badgeCollectorDesc', shape: 'ring', hue: 185 },
  { id: 'veteran30', emoji: '🏛️', nameKey: 'badgeVeteran', descKey: 'badgeVeteranDesc', shape: 'shield', hue: 90 },
]

export function badgeById(id: string): BadgeDef | undefined {
  return BADGE_DEFS.find((b) => b.id === id)
}

/** Which badges this play history has earned. Pure function of the log. */
export function computeEarnedBadges(log: PlayLogEntry[]): string[] {
  let totalMs = 0
  let night = 0
  let early = 0
  let weekend = 0
  let completed = 0
  const perArtist = new Map<string, number>()
  const perSong = new Map<string, number>()
  const perDayMs = new Map<number, number>()

  for (const e of log) {
    totalMs += e.ms
    if (e.a) perArtist.set(e.a, (perArtist.get(e.a) ?? 0) + 1)
    perSong.set(e.id, (perSong.get(e.id) ?? 0) + 1)
    const d = new Date(e.at)
    const h = d.getHours()
    if (h < 5) night++
    else if (h < 9) early++
    const dow = d.getDay()
    if (dow === 0 || dow === 6) weekend++
    if (e.d > 0 && e.ms >= e.d * 0.85) completed++
    const day = Math.floor(e.at / 86_400_000)
    perDayMs.set(day, (perDayMs.get(day) ?? 0) + e.ms)
  }

  // Longest run of consecutive listening days.
  let bestStreak = 0
  let cur = 0
  const days = [...perDayMs.keys()].sort((a, b) => a - b)
  for (let i = 0; i < days.length; i++) {
    cur = i > 0 && days[i] === days[i - 1] + 1 ? cur + 1 : 1
    if (cur > bestStreak) bestStreak = cur
  }

  const hours = totalMs / 3_600_000
  const maxArtist = Math.max(0, ...perArtist.values())
  const maxSong = Math.max(0, ...perSong.values())
  const maxDayMs = Math.max(0, ...perDayMs.values())

  const earned: string[] = []
  if (hours >= 10) earned.push('h10')
  if (hours >= 50) earned.push('h50')
  if (hours >= 100) earned.push('h100')
  if (perArtist.size >= 50) earned.push('explorer')
  if (maxArtist >= 100) earned.push('superfan')
  if (night >= 50) earned.push('nightowl')
  if (early >= 30) earned.push('earlybird')
  if (log.length >= 200 && completed / log.length >= 0.8) earned.push('finisher')
  if (bestStreak >= 7) earned.push('streak7')
  if (log.length >= 500) earned.push('regular500')
  if (maxSong >= 25) earned.push('repeat25')
  if (maxDayMs >= 4 * 3_600_000) earned.push('marathon')
  if (weekend >= 100) earned.push('weekend')
  if (perSong.size >= 300) earned.push('collector')
  if (perDayMs.size >= 30) earned.push('veteran30')
  return earned
}
