import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const tick = async () => setIsMaximized(await window.bombo.window.isMaximized())
    tick()
    const id = setInterval(tick, 400)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="drag-region fixed top-0 left-0 right-0 h-[var(--titlebar-h)] z-50 flex items-center justify-between px-4 bg-black/25 backdrop-blur-xl border-b border-white/[0.04]"
    >
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
