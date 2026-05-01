import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Square, X, Copy, ChevronLeft, ChevronRight } from 'lucide-react'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const tick = async () => setIsMaximized(await window.bombo.window.isMaximized())
    tick()
    const id = setInterval(tick, 400)
    return () => clearInterval(id)
  }, [])

  // Wire mouse back/forward (button 3 / 4) into the same nav so the
  // standard "side mouse buttons" most users have on Windows mice work
  // out of the box. Pointer events fire on `pointerup` for compat.
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); navigate(-1) }
      else if (e.button === 4) { e.preventDefault(); navigate(1) }
    }
    window.addEventListener('mouseup', onMouse)
    return () => window.removeEventListener('mouseup', onMouse)
  }, [navigate])

  return (
    <div
      className="drag-region fixed top-0 left-0 right-0 h-[var(--titlebar-h)] z-50 flex items-center justify-between px-4 bg-black/25 backdrop-blur-xl border-b border-white/[0.04]"
      style={{
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 pointer-events-none">
          <img
            src="./cat-blinking.gif"
            alt=""
            className="w-5 h-5 rounded-sm object-cover"
            draggable={false}
          />
          <span className="text-[13px] font-bold tracking-tight text-obsidian-100">
            Çatal<span className="accent-text">ify</span>
          </span>
        </div>
        <div className="no-drag flex items-center gap-0.5 ml-2">
          <NavButton onClick={() => navigate(-1)} title="Back (Alt+←)">
            <ChevronLeft size={14} />
          </NavButton>
          <NavButton onClick={() => navigate(1)} title="Forward (Alt+→)">
            <ChevronRight size={14} />
          </NavButton>
        </div>
      </div>
      <div className="no-drag flex items-center">
        <TitleButton onClick={() => window.bombo.window.minimize()} aria-label="Minimize">
          <Minus size={14} />
        </TitleButton>
        <TitleButton onClick={() => window.bombo.window.maximize()} aria-label="Maximize">
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </TitleButton>
        <TitleButton onClick={() => window.bombo.window.close()} danger aria-label="Close">
          <X size={14} />
        </TitleButton>
      </div>
    </div>
  )
}

function NavButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded-full flex items-center justify-center text-obsidian-300 hover:text-white hover:bg-white/[0.08] transition"
    >
      {children}
    </button>
  )
}

function TitleButton({
  children,
  onClick,
  danger,
  ...rest
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      onClick={onClick}
      className={`w-11 h-9 flex items-center justify-center text-obsidian-300 transition-colors ${
        danger ? 'hover:bg-red-600/80 hover:text-white' : 'hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
