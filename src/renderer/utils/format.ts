export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function artworkUrl(
  template: string | undefined | null,
  size: number
): string | undefined {
  if (!template) return undefined
  return template.replace('{w}', String(size)).replace('{h}', String(size))
}

export function clsx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/** Compact "time since" for friend activity: now / 5m / 3h / 2d / 4w ago. */
export function timeAgo(epochSec: number): string {
  if (!epochSec) return ''
  const s = Math.max(0, Math.floor(Date.now() / 1000) - epochSec)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}
