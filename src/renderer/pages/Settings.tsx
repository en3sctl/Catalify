import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Flame,
  Globe,
  ListMusic,
  Moon,
  Palette,
  Sliders,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react'
import { clsx } from '../utils/format'
import { usePlayer } from '../store/player'
import { Lang, Theme, useSettings } from '../store/settings'
import { useT } from '../i18n'

/**
 * Settings page — privacy toggles + sound recommendations.
 *
 * Privacy keys are persisted in electron-store under `settings.privacy`.
 * They have no real effect today (no shared profile feature has shipped
 * yet) but writing them now means: when we add friends/social later, the
 * defaults the user picks here are already on disk and just plug in.
 *
 * No in-app equalizer — Apple Music's Widevine-encrypted streams can't
 * be routed through a Web Audio graph, so any "EQ" we'd render in here
 * would be cosmetic only. We point users at OS-level alternatives that
 * actually do something instead.
 */

type PrivacyState = {
  showProfileToFriends: boolean
  showListeningActivity: boolean
  showFollowingArtists: boolean
  showPlaylists: boolean
}

const PRIVACY_DEFAULTS: PrivacyState = {
  showProfileToFriends: true,
  showListeningActivity: false,
  showFollowingArtists: true,
  showPlaylists: true,
}

const SOUND_TOOLS: { name: string; platform: string; url: string; note: string }[] = [
  {
    name: 'Equalizer APO',
    platform: 'Windows',
    url: 'https://sourceforge.net/projects/equalizerapo/',
    note: 'Free, system-wide EQ. Pair with Peace UI for a graphical interface.',
  },
  {
    name: 'SoundSource',
    platform: 'macOS',
    url: 'https://rogueamoeba.com/soundsource/',
    note: 'Per-app EQ + audio routing. Paid but commonly recommended.',
  },
  {
    name: 'eqMac',
    platform: 'macOS',
    url: 'https://eqmac.app/',
    note: 'Free open-source system EQ for Mac.',
  },
  {
    name: 'EasyEffects',
    platform: 'Linux',
    url: 'https://github.com/wwmm/easyeffects',
    note: 'Free PipeWire effects engine including a parametric EQ.',
  },
]

export function Settings() {
  const [privacy, setPrivacy] = useState<PrivacyState>(PRIVACY_DEFAULTS)
  const allowExplicit = usePlayer((s) => s.allowExplicit)
  const setAllowExplicit = usePlayer((s) => s.setAllowExplicit)
  const lang = useSettings((s) => s.lang)
  const setLang = useSettings((s) => s.setLang)
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)
  const t = useT()

  useEffect(() => {
    window.bombo.store.get<PrivacyState>('settings.privacy').then((v) => {
      if (v) setPrivacy({ ...PRIVACY_DEFAULTS, ...v })
    })
  }, [])

  const update = <K extends keyof PrivacyState>(key: K, value: PrivacyState[K]) => {
    const next = { ...privacy, [key]: value }
    setPrivacy(next)
    window.bombo.store.set('settings.privacy', next)
  }

  return (
    <div className="space-y-10 pb-16 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          to="/profile"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.07] text-cream/80 hover:text-cream transition"
          title="Back to profile"
        >
          <ChevronLeft size={16} />
        </Link>
        <div>
          <div className="text-[12px] uppercase tracking-[0.25em] text-cream/55">
            {t('settingsKicker')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.025em] leading-[1]">
            {t('preferences')}
          </h1>
        </div>
      </div>

      {/* Appearance — language + theme. */}
      <Section
        icon={<Palette size={16} />}
        title={t('appearance')}
        subtitle={t('appearanceSub')}
      >
        <ChoiceRow
          icon={<Globe size={15} />}
          title={t('language')}
          description={t('languageDesc')}
          options={[
            { value: 'en' as Lang, label: 'English' },
            { value: 'tr' as Lang, label: 'Türkçe' },
          ]}
          value={lang}
          onChange={setLang}
        />
        <ChoiceRow
          icon={
            theme === 'light' ? <Sun size={15} /> : theme === 'dark' ? <Moon size={15} /> : <Sparkles size={15} />
          }
          title={t('theme')}
          description={
            theme === 'adaptive'
              ? t('themeAdaptiveDesc')
              : theme === 'dark'
                ? t('themeDarkDesc')
                : t('themeLightDesc')
          }
          options={[
            { value: 'adaptive' as Theme, label: t('themeAdaptive') },
            { value: 'dark' as Theme, label: t('themeDark') },
            { value: 'light' as Theme, label: t('themeLight') },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </Section>

      {/* Content — actually wired right now (filters everywhere). */}
      <Section
        icon={<Flame size={16} />}
        title={t('contentTitle')}
        subtitle={t('contentSub')}
      >
        <Toggle
          icon={<Flame size={15} />}
          title={t('allowExplicit')}
          description={t('allowExplicitDesc')}
          value={allowExplicit}
          onChange={setAllowExplicit}
        />
      </Section>

      {/* Privacy */}
      <Section
        icon={<Eye size={16} />}
        title={t('privacyTitle')}
        subtitle={t('privacySub')}
      >
        <Toggle
          icon={<Users size={15} />}
          title={t('publicProfile')}
          description={t('publicProfileDesc')}
          value={privacy.showProfileToFriends}
          onChange={(v) => update('showProfileToFriends', v)}
        />
        <Toggle
          icon={<Sparkles size={15} />}
          title={t('listeningActivity')}
          description={t('listeningActivityDesc')}
          value={privacy.showListeningActivity}
          onChange={(v) => update('showListeningActivity', v)}
        />
        <Toggle
          icon={<EyeOff size={15} />}
          title={t('followedArtistsSetting')}
          description={t('followedArtistsDesc')}
          value={privacy.showFollowingArtists}
          onChange={(v) => update('showFollowingArtists', v)}
        />
        <Toggle
          icon={<ListMusic size={15} />}
          title={t('showPlaylists')}
          description={t('showPlaylistsDesc')}
          value={privacy.showPlaylists}
          onChange={(v) => update('showPlaylists', v)}
        />
      </Section>

      {/* Advanced — collapsed by default. The OS-level EQ section lives
          here so a casual user opening Settings doesn't immediately read
          "we don't have an equalizer, download something else". Power
          users who actually want EQ can open Advanced and find it. */}
      <AdvancedSection />

      <div className="pt-2 text-[11.5px] text-cream/45">{t('storedLocally')}</div>
    </div>
  )
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-cream/85">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-[20px] font-semibold tracking-tight leading-none">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[12.5px] text-cream/55 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

/** Row with a segmented set of options instead of an on/off switch. */
function ChoiceRow<V extends string>({
  icon,
  title,
  description,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  options: { value: V; label: string }[]
  value: V
  onChange: (next: V) => void
}) {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
      <div className="w-9 h-9 rounded-xl bg-white/[0.06] text-cream/85 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-cream">{title}</div>
        <div className="text-[11.5px] text-cream/55 mt-0.5">{description}</div>
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-white/[0.05] p-1 flex-shrink-0">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition',
              value === opt.value
                ? 'accent-bg text-obsidian-950 shadow'
                : 'text-cream/60 hover:text-cream hover:bg-white/[0.06]',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/[0.09] transition text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-white/[0.06] text-cream/85 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-cream">{title}</div>
        <div className="text-[11.5px] text-cream/55 mt-0.5">{description}</div>
      </div>
      <div
        className={clsx(
          'w-10 h-6 rounded-full relative transition flex-shrink-0',
          value ? 'accent-bg' : 'bg-white/[0.08]',
        )}
      >
        <div
          className={clsx(
            'absolute top-[2px] w-5 h-5 rounded-full bg-cream transition-all shadow-[0_2px_6px_-1px_rgba(0,0,0,0.5)]',
            value ? 'left-[18px]' : 'left-[2px]',
          )}
        />
      </div>
    </button>
  )
}

/**
 * Advanced settings drawer — collapsed by default. Surfaces the
 * "OS-level EQ" workaround (and any future power-user knobs) without
 * making them the first thing a casual user reads in Settings.
 */
function AdvancedSection() {
  const [open, setOpen] = useState(false)
  const t = useT()
  return (
    <section className="pt-4 border-t border-white/[0.05]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left text-cream/70 hover:text-cream transition"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-[13.5px] font-semibold">{t('advanced')}</span>
        <span className="text-[11.5px] text-cream/45">{t('advancedHint')}</span>
      </button>
      {open && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-cream/85">
              <Sliders size={16} />
            </div>
            <div>
              <h3 className="font-display text-[16px] font-semibold tracking-tight leading-none">
                Audio output & EQ
              </h3>
              <p className="text-[12px] text-cream/55 mt-1 max-w-xl">
                Çatalify can't apply an in-app equalizer to Apple Music
                streams (DRM blocks Web Audio routing). These OS-level
                tools sit between any app and your speakers and work for
                everything — Çatalify, Spotify, browser, etc.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {SOUND_TOOLS.map((tool) => (
              <a
                key={tool.url}
                href={tool.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.1] transition group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-cream truncate">
                      {tool.name}
                    </span>
                    <span className="text-[10.5px] uppercase tracking-[0.15em] text-cream/45 font-mono">
                      {tool.platform}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-cream/55 mt-0.5">
                    {tool.note}
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className="text-cream/40 group-hover:text-cream/80 transition flex-shrink-0"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
