import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * A horizontally-scrolling rail of items, with fade edges and peek-style
 * navigation arrows that appear on hover. Less visual weight than a grid.
 */
export function Rail({
  title,
  subtitle,
  action,
  children,
  widthClass = 'w-44',
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  widthClass?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * (el.clientWidth - 80), behavior: 'smooth' })
  }

  return (
    <section className="group/rail">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-[22px] font-display leading-tight">{title}</h2>
          {subtitle && <p className="text-[12px] text-obsidian-300 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <div className="flex gap-1 opacity-0 group-hover/rail:opacity-100 transition-opacity">
            <button
              onClick={() => scroll(-1)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scroll(1)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1 snap-x"
          style={{
            scrollbarWidth: 'none',
            WebkitMaskImage: 'linear-gradient(90deg, black 0%, black 95%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, black 0%, black 95%, transparent 100%)',
          }}
        >
          <style>{`
            .rail-scroll::-webkit-scrollbar { display: none; }
          `}</style>
          {Array.isArray(children)
            ? (children as any[]).map((c, i) => (
                <div key={i} className={`flex-shrink-0 ${widthClass} snap-start`}>
                  {c}
                </div>
              ))
            : <div className={`flex-shrink-0 ${widthClass} snap-start`}>{children}</div>}
        </div>
      </div>
    </section>
  )
}
