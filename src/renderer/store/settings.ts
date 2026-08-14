import { create } from 'zustand'

export type Lang = 'en' | 'tr'
export type Theme = 'adaptive' | 'dark' | 'light'

/**
 * App-level appearance/locale settings. Persisted to electron-store
 * (`settings.lang`, `settings.theme`) so they survive restarts and are
 * shared with the mini-player window (each window calls `init()` on boot).
 *
 * Themes:
 *  - adaptive — current signature look: accent + backdrop follow artwork
 *  - dark     — static dark: fixed amber accent, no artwork wash
 *  - light    — light surfaces via [data-theme="light"] CSS var overrides
 */
interface SettingsState {
  lang: Lang
  theme: Theme
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  init: () => Promise<void>
}

function applyThemeAttr(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export const useSettings = create<SettingsState>((set) => ({
  lang: 'en',
  theme: 'adaptive',
  setLang: (lang) => {
    set({ lang })
    window.bombo.store.set('settings.lang', lang)
  },
  setTheme: (theme) => {
    applyThemeAttr(theme)
    set({ theme })
    window.bombo.store.set('settings.theme', theme)
  },
  init: async () => {
    const [lang, theme] = await Promise.all([
      window.bombo.store.get<Lang>('settings.lang'),
      window.bombo.store.get<Theme>('settings.theme'),
    ])
    const safeTheme: Theme = theme === 'dark' || theme === 'light' ? theme : 'adaptive'
    applyThemeAttr(safeTheme)
    set({ lang: lang === 'tr' ? 'tr' : 'en', theme: safeTheme })
  },
}))
