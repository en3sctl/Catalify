import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Radio as RadioIcon, Play } from 'lucide-react'
import { search, playStation } from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { artworkUrl } from '../utils/format'

export function Radio() {
  const [stations, setStations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        // Apple Music's search is the most reliable way to surface stations
        // across storefronts without needing curated endpoint access.
        const queries = ['hits', 'chill', 'pop', 'rock', 'jazz', 'lo-fi', 'türkçe']
        const results = await Promise.all(
          queries.map((q) =>
            search(q, ['stations'], 6).then((r) => r?.stations?.data ?? []).catch(() => [])
          )
        )
        const flat = results.flat()
        // Dedupe by id
        const seen = new Set<string>()
        const unique: any[] = []
        for (const s of flat) {
          if (seen.has(s.id)) continue
          seen.add(s.id)
          unique.push(s)
        }
        setStations(unique)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative pt-2"
      >
        <div
          className="absolute -inset-x-8 -top-8 h-[220px] pointer-events-none"
          style={{
            background:
              'radial-gradient(500px 220px at 20% 50%, rgb(255 200 140 / 0.22), transparent 70%), radial-gradient(420px 200px at 80% 40%, rgb(200 140 255 / 0.2), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div className="relative flex items-end gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center accent-gradient text-dusk shadow-glow">
            <RadioIcon size={30} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest accent-text font-medium">live on the airwaves</div>
            <h1 className="text-5xl font-display leading-tight">Radio</h1>
            <p className="text-obsidian-300 mt-1 text-sm">curated + algorithmic stations from apple music</p>
          </div>
        </div>
      </motion.div>

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-obsidian-800/60 animate-pulse" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stations.map((s) => <StationCard key={s.id} station={s} />)}
      </div>

      {!loading && stations.length === 0 && (
        <div className="text-obsidian-300 italic text-center py-10">
          No stations available in your storefront right now.
        </div>
      )}
    </div>
  )
}

function StationCard({ station }: { station: any }) {
  const attrs = station.attributes ?? {}
  const art = artworkUrl(attrs.artwork?.url, 400)
  const notes = attrs.editorialNotes?.short || attrs.editorialNotes?.standard || ''
  return (
    <button
      onClick={() => playStation(station.id).catch(console.error)}
      className="group relative lofi-card rounded-2xl overflow-hidden text-left hover:brightness-110 transition"
    >
      <Artwork src={art} size="hero" rounded="md" className="rounded-none" alt={attrs.name} />
      <div className="p-3">
        <div className="truncate text-[13.5px] font-semibold text-cream">{attrs.name}</div>
        {notes && <div className="line-clamp-2 text-[11px] text-obsidian-300 mt-1 leading-snug">{notes}</div>}
      </div>
      <div className="absolute top-3 right-3 w-10 h-10 rounded-full accent-bg text-dusk flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-glow">
        <Play size={14} fill="currentColor" className="translate-x-[1px]" />
      </div>
    </button>
  )
}
