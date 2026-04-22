import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToast } from '../store/toast'

const ICON = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
}
const TINT = {
  info: 'text-cream',
  success: 'text-emerald-300',
  error: 'text-rose-300',
}

export function Toasts() {
  const items = useToast((s) => s.items)
  const dismiss = useToast((s) => s.dismiss)

  return (
    <div className="fixed bottom-[calc(var(--nowplaying-h)+16px)] left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICON[t.kind]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="pointer-events-auto liquid-glass rounded-2xl px-4 py-3 min-w-[300px] max-w-[460px] flex items-start gap-3 shadow-deep"
            >
              <Icon size={18} className={`${TINT[t.kind]} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-cream">{t.title}</div>
                {t.message && (
                  <div className="text-[12px] text-obsidian-300 mt-0.5 leading-snug">
                    {t.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-obsidian-400 hover:text-cream mt-0.5"
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
