import { useState } from 'react'
import { Music } from 'lucide-react'
import { clsx } from '../utils/format'

export function Artwork({
  src,
  alt,
  size = 'md',
  rounded = 'md',
  className = '',
}: {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  rounded?: 'sm' | 'md' | 'lg' | 'full'
  className?: string
}) {
  const [errored, setErrored] = useState(false)
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
      {src && !errored ? (
        <img
          src={src}
          alt={alt ?? ''}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
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
