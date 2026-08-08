import { useState } from 'react'
import { Music } from 'lucide-react'
import { clsx } from '../utils/format'

export function Artwork({
  src,
  fallbackSrc,
  alt,
  size = 'md',
  rounded = 'md',
  className = '',
}: {
  src?: string
  /**
   * Second-chance URL when `src` 404s. Apple's user-playlist cover
   * templates are signed and EXPIRE after a few weeks — callers pass a
   * fresh catalog track's art here so shared covers never go blank.
   */
  fallbackSrc?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  rounded?: 'sm' | 'md' | 'lg' | 'full'
  className?: string
}) {
  const [failedSrcs, setFailedSrcs] = useState<string[]>([])
  const effective = [src, fallbackSrc].find((s) => s && !failedSrcs.includes(s))
  const errored = !effective
  const dims = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
    xl: 'w-40 h-40',
    hero: 'w-full aspect-square',
  }[size]
  const r = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-xl',
    full: 'rounded-full',
  }[rounded]

  return (
    <div className={clsx(dims, r, 'overflow-hidden bg-obsidian-800 flex-shrink-0 relative shadow-deep', className)}>
      {!errored ? (
        <img
          src={effective}
          alt={alt ?? ''}
          className="w-full h-full object-cover"
          onError={() => setFailedSrcs((f) => [...f, effective as string])}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-obsidian-400">
          <Music size={20} />
        </div>
      )}
    </div>
  )
}
