import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AtSign, Check, Loader2, Lock, Radio, Sparkles, X } from 'lucide-react'
import { useSocial } from '../store/social'
import { HANDLE_RE, SocialUser, getUserByHandle, handleAvailable } from '../utils/social-api'
import { FollowListModal } from './FollowListModal'
import { clsx } from '../utils/format'
import { toast } from '../store/toast'

/**
 * Çatalify social account card (Phase 1). When the user hasn't claimed a
 * handle yet, it shows a sign-up form (handle + display name with live
 * availability). Once claimed, it shows @handle and lets them edit their
 * display name + bio. The handle is the identity friends will search for.
 */
export function SocialProfileCard({ defaultName }: { defaultName?: string }) {
  const { user, ready, register, login, update, signOut } = useSocial()

  if (!ready) {
    return (
      <div className="rounded-2xl liquid-glass p-5 flex items-center gap-2 text-obsidian-300 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading your Çatalify account…
      </div>
    )
  }

  return user ? (
    <ClaimedCard onUpdate={update} onSignOut={signOut} user={user} />
  ) : (
    <ClaimForm defaultName={defaultName} onRegister={register} onLogin={login} />
  )
}

/* ── Not signed up yet: claim a handle ─────────────────────── */

function ClaimForm({
  defaultName,
  onRegister,
  onLogin,
}: {
  defaultName?: string
  onRegister: (handle: string, displayName: string) => Promise<void>
  onLogin: (handle: string) => Promise<void>
}) {
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState(defaultName ?? '')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const debounce = useRef<number | null>(null)

  const valid = HANDLE_RE.test(handle)

  useEffect(() => {
    setAvailable(null)
    if (debounce.current) window.clearTimeout(debounce.current)
    if (!valid) return
    setChecking(true)
    debounce.current = window.setTimeout(async () => {
      const ok = await handleAvailable(handle)
      setAvailable(ok)
      setChecking(false)
    }, 350)
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current)
    }
  }, [handle, valid])

  const canSubmit = valid && available === true && displayName.trim().length > 0 && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      await onRegister(handle, displayName.trim())
      toast.success('Çatalify account created', `You're @${handle}`)
    } catch (err: any) {
      if (err?.code === 'handle_taken') {
        setAvailable(false)
        toast.error('Handle taken', 'Pick another username.')
      } else {
        toast.error('Couldn\'t create account', err?.message || String(err))
      }
    } finally {
      setBusy(false)
    }
  }

  // The handle is taken — maybe it's the user's own account on this device.
  // Try logging in with the stored device key; only this device's key works.
  const tryLogin = async () => {
    setBusy(true)
    try {
      await onLogin(handle)
      toast.success('Signed in', `Welcome back, @${handle}`)
    } catch (err: any) {
      if (err?.status === 401) {
        toast.error('That username isn\'t yours', 'It belongs to a different device/account.')
      } else {
        toast.error('Couldn\'t sign in', err?.message || String(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl liquid-glass p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={15} className="accent-text" />
        <h2 className="font-display text-[18px] font-bold tracking-tight">Join Çatalify social</h2>
      </div>
      <p className="text-[12.5px] text-obsidian-300 mb-4 max-w-lg">
        Claim a username so friends can find and follow you, see your playlists, and
        what you're playing. One-time — no email or password.
      </p>

      <div className="flex flex-col gap-3 max-w-md">
        <div>
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] focus-within:border-white/[0.16] transition">
            <AtSign size={15} className="text-obsidian-400 flex-shrink-0" />
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              maxLength={20}
              className="flex-1 bg-transparent outline-none text-[14px] text-cream placeholder:text-obsidian-500"
            />
            {handle.length > 0 && (
              <span className="flex-shrink-0">
                {checking ? (
                  <Loader2 size={15} className="animate-spin text-obsidian-400" />
                ) : !valid ? (
                  <X size={15} className="text-rose-400" />
                ) : available === true ? (
                  <Check size={15} className="text-emerald-400" />
                ) : available === false ? (
                  <X size={15} className="text-rose-400" />
                ) : null}
              </span>
            )}
          </div>
          <p className="text-[11px] text-obsidian-400 mt-1.5 ml-1">
            {handle.length > 0 && !valid
              ? '2–20 characters: letters, numbers, underscore'
              : available === false && valid
                ? 'That username is taken'
                : 'Lowercase letters, numbers and _'}
          </p>
        </div>

        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
          maxLength={64}
          className="rounded-xl px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] focus:border-white/[0.16] outline-none text-[14px] text-cream placeholder:text-obsidian-500 transition"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-5 py-2.5 rounded-xl accent-bg text-obsidian-950 font-semibold text-[13px] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
          {valid && available === false && (
            <button
              onClick={tryLogin}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-white/[0.06] text-white text-[13px] hover:bg-white/[0.1] disabled:opacity-40 transition"
              title="If this username is yours on this device, sign back in"
            >
              Log in instead
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Signed up: show + edit profile ────────────────────────── */

function ClaimedCard({
  user,
  onUpdate,
  onSignOut,
}: {
  user: SocialUser
  onUpdate: (patch: { displayName?: string; bio?: string; hideLists?: boolean }) => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(user.displayName)
  const [draftBio, setDraftBio] = useState(user.bio ?? '')
  const [busy, setBusy] = useState(false)
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null)
  const [modalWhich, setModalWhich] = useState<'followers' | 'following' | null>(null)

  useEffect(() => {
    getUserByHandle(user.handle).then((u) => {
      if (u) setCounts({ followers: u.followers ?? 0, following: u.following ?? 0 })
    })
  }, [user.handle])

  const save = async () => {
    setBusy(true)
    try {
      await onUpdate({ displayName: draftName.trim() || user.displayName, bio: draftBio.trim() })
      setEditing(false)
      toast.info('Profile updated')
    } catch (err: any) {
      toast.error('Couldn\'t save', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl liquid-glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 accent-text">
            <Sparkles size={14} />
            <span className="text-[11px] uppercase tracking-[0.18em] font-medium">Çatalify social</span>
          </div>
          <div className="mt-1.5 text-[20px] font-display font-bold tracking-tight text-cream truncate">
            @{user.handle}
          </div>
          {counts && (
            <div className="mt-1.5 flex items-center gap-4 text-[12.5px] text-obsidian-300">
              <button onClick={() => setModalWhich('following')} className="hover:text-cream transition">
                <b className="text-cream">{counts.following}</b> following
              </button>
              <button onClick={() => setModalWhich('followers')} className="hover:text-cream transition">
                <b className="text-cream">{counts.followers}</b> {counts.followers === 1 ? 'follower' : 'followers'}
              </button>
            </div>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setDraftName(user.displayName)
                setDraftBio(user.bio ?? '')
                setEditing(true)
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.07] text-[12px] text-cream/85 transition"
            >
              Edit profile
            </button>
            <button
              onClick={() => {
                if (confirm('Sign out of Çatalify social? You can sign back in with the same username on this device.')) {
                  onSignOut()
                }
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12px] text-obsidian-300 hover:text-cream transition"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-4 flex flex-col gap-3 max-w-md">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Display name"
            maxLength={64}
            className="rounded-xl px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] focus:border-white/[0.16] outline-none text-[14px] text-cream placeholder:text-obsidian-500 transition"
          />
          <textarea
            value={draftBio}
            onChange={(e) => setDraftBio(e.target.value)}
            placeholder="Bio — optional"
            rows={2}
            maxLength={200}
            className="rounded-xl px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] focus:border-white/[0.16] outline-none text-[13.5px] text-cream placeholder:text-obsidian-500 resize-none transition"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 rounded-xl accent-bg text-obsidian-950 font-semibold text-[13px] hover:brightness-110 disabled:opacity-50 transition"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl text-[13px] text-obsidian-200 hover:text-white hover:bg-white/[0.04] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <div className="text-[14px] text-cream/90">{user.displayName}</div>
          {user.bio && <p className="text-[12.5px] text-obsidian-300 mt-1 max-w-lg">{user.bio}</p>}
          <div className="mt-3 flex flex-col gap-2.5">
            <ShareActivityToggle />
            <Toggle
              on={!user.hideLists}
              onChange={(v) => onUpdate({ hideLists: !v })}
              icon={<Lock size={13} className={user.hideLists ? 'text-obsidian-400' : 'accent-text'} />}
              label="Let others see my followers / following"
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {modalWhich && (
          <FollowListModal userId={user.id} which={modalWhich} onClose={() => setModalWhich(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

/** A labelled pill toggle with an unambiguous On/Off state. */
function Toggle({
  on,
  onChange,
  icon,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex items-center gap-2.5 group"
      aria-pressed={on}
      title={label}
    >
      <span
        className="relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0"
        style={{ backgroundColor: on ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.14)' }}
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-[left] duration-200"
          style={{ left: on ? 20 : 2 }}
        />
      </span>
      <span className="flex items-center gap-1.5 text-[12.5px] text-obsidian-200 group-hover:text-cream transition text-left">
        {icon}
        {label}
        <span className={clsx('text-[11px] font-semibold flex-shrink-0', on ? 'accent-text' : 'text-obsidian-500')}>
          · {on ? 'On' : 'Off'}
        </span>
      </span>
    </button>
  )
}

/** Privacy toggle: broadcast "now playing" to friends, or stay invisible. */
function ShareActivityToggle() {
  const shareActivity = useSocial((s) => s.shareActivity)
  const setShareActivity = useSocial((s) => s.setShareActivity)
  return (
    <Toggle
      on={shareActivity}
      onChange={setShareActivity}
      icon={<Radio size={13} className={shareActivity ? 'accent-text' : 'text-obsidian-400'} />}
      label="Share my listening activity"
    />
  )
}
