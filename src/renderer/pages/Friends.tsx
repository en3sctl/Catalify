import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, Users, X } from 'lucide-react'
import { useSocial } from '../store/social'
import { FriendUser, getFollowing, searchUsers } from '../utils/social-api'
import { UserRow } from '../components/UserRow'
import { SocialProfileCard } from '../components/SocialProfileCard'

/**
 * Friends page — search people by @handle and follow them, plus the list of
 * people you already follow. Requires a Çatalify account (shows the claim
 * card if not signed up yet).
 */
export function Friends() {
  const { user, ready } = useSocial()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<FriendUser[]>([])
  const [searching, setSearching] = useState(false)
  const [following, setFollowing] = useState<FriendUser[]>([])
  const debounce = useRef<number | null>(null)

  useEffect(() => {
    if (!user) return
    getFollowing().then(setFollowing)
  }, [user?.id])

  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current)
    if (!term.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounce.current = window.setTimeout(async () => {
      const r = await searchUsers(term.trim())
      setResults(r)
      setSearching(false)
    }, 300)
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current)
    }
  }, [term])

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div className="flex items-center gap-3">
        <Users size={26} className="accent-text" />
        <h1 className="text-4xl font-display leading-tight">Friends</h1>
      </div>

      {ready && !user ? (
        <SocialProfileCard />
      ) : (
        <>
          {/* Search people */}
          <section>
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/[0.06] focus-within:border-white/[0.14] transition">
              <SearchIcon size={17} className="text-obsidian-300 flex-shrink-0" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search people by @username…"
                className="flex-1 bg-transparent outline-none text-[14px] text-cream placeholder:text-obsidian-400"
              />
              {term && (
                <button onClick={() => setTerm('')} className="text-obsidian-400 hover:text-white transition">
                  <X size={15} />
                </button>
              )}
            </div>
            {term && (
              <div className="mt-3 rounded-2xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {searching && <div className="px-4 py-3 text-[13px] text-obsidian-400 italic">Searching…</div>}
                {!searching && results.length === 0 && (
                  <div className="px-4 py-3 text-[13px] text-obsidian-400 italic">No users match "{term}".</div>
                )}
                {results.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            )}
          </section>

          {/* Following */}
          <section>
            <h2 className="font-display text-[20px] font-bold tracking-tight mb-3">
              Following {following.length > 0 && <span className="text-obsidian-400 font-normal">· {following.length}</span>}
            </h2>
            {following.length === 0 ? (
              <p className="text-[13px] text-obsidian-400 italic">
                You're not following anyone yet. Search a friend's @username above to follow them.
              </p>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {following.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
