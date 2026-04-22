import { usePlayer } from '../store/player'
import { LyricsPanel } from '../components/LyricsPanel'

export function Lyrics() {
  const np = usePlayer((s) => s.nowPlaying)
  if (!np) {
    return <div className="text-obsidian-400 italic">Play something to see lyrics.</div>
  }
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="font-display text-4xl font-bold tracking-tight">{np.title}</h1>
        <div className="text-obsidian-300 mt-1">{np.artistName}</div>
      </div>
      <div className="flex-1 min-h-0">
        <LyricsPanel />
      </div>
    </div>
  )
}
