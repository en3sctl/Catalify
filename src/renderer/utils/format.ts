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
