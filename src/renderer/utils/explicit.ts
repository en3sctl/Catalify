import { useMemo } from 'react'
import { usePlayer } from '../store/player'

/**
 * Apple Music tags every track / album with a `contentRating` of
 * `'explicit' | 'clean' | undefined`. When the user turns off
 * "Allow explicit content" we hide everything tagged `'explicit'`
 * across the app — track rows, grid cards, search results, and
 * (most importantly) the queue we hand to MusicKit.
 */
export function isExplicit(item: any): boolean {
  return item?.attributes?.contentRating === 'explicit'
}

/**
 * React-friendly filter — re-runs only when the underlying list or
 * the preference flips. Caller passes the raw list, gets back the
 * list it should render / play.
 */
export function useExplicitFilter<T>(items: T[]): T[] {
  const allow = usePlayer((s) => s.allowExplicit)
  return useMemo(
    () => (allow ? items : items.filter((it) => !isExplicit(it as any))),
    [items, allow],
  )
}
