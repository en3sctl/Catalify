import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useMusicKit } from './hooks/useMusicKit'
import { useArtColors } from './hooks/useArtColors'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useSyncAndPresence } from './hooks/useSyncAndPresence'
import { useUpdateNotifier } from './hooks/useUpdateNotifier'
import { usePlayer } from './store/player'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { NowPlayingBar } from './components/NowPlayingBar'
import { BackdropAura } from './components/BackdropAura'
import { LoginGate } from './components/LoginGate'
import { Home } from './pages/Home'
import { Search } from './pages/Search'
import { Library } from './pages/Library'
import { Album } from './pages/Album'
import { Playlist } from './pages/Playlist'
import { NowPlaying } from './pages/NowPlaying'
import { NewPlaylist } from './pages/NewPlaylist'
import { Lyrics } from './pages/Lyrics'
import { MiniPlayer } from './pages/MiniPlayer'
import { Liked } from './pages/Liked'
import { Radio } from './pages/Radio'
import { Artist } from './pages/Artist'
import { Toasts } from './components/Toasts'
import { ContextMenuProvider } from './components/ContextMenuProvider'
import { LayoutGroup } from 'framer-motion'

export default function App() {
  const location = useLocation()
  const isMiniPlayer = location.hash === '#/mini' || location.pathname === '/mini'

  if (isMiniPlayer) return <MiniPlayerApp />
  return <MainApp />
}

function MainApp() {
  const location = useLocation()
  useMusicKit()
  useArtColors()
  useKeyboardShortcuts()
  useSyncAndPresence({ isMiniPlayer: false })
  useRestoreLikes()
  useUpdateNotifier()
  const fullScreen = useFullScreen()

  // Now Playing is an immersive takeover — no sidebar, no bottom bar, no
  // padding — so the blurred album art fills the whole canvas like Apple
  // Music's "full screen player" on macOS.
  const immersive = location.pathname === '/now-playing'
  // In OS fullscreen we also drop the custom title bar so the whole
  // screen is Çatalify — nothing between content and the monitor edge.
  const hideChrome = fullScreen

  return (
    <ContextMenuProvider>
      {/* LayoutGroup makes framer-motion treat elements with matching
          `layoutId` as the same element across mounts — so when the route
          changes to /now-playing, the 48 px cover in the bottom bar morphs
          smoothly into the big hero cover (Spotify-style expand), instead
          of a snap cut. */}
      <LayoutGroup>
        <div className="noise w-screen h-screen text-obsidian-100 overflow-hidden">
          <BackdropAura />
          {!hideChrome && <TitleBar />}
          {!immersive && <Sidebar />}
          <main
            className="fixed overflow-y-auto overflow-x-hidden"
            style={{
              top: hideChrome ? 0 : 'var(--titlebar-h)',
              left: immersive ? 0 : 'var(--sidebar-w)',
              right: 0,
              bottom: immersive ? 0 : 'var(--nowplaying-h)',
            }}
          >
            <div className={immersive ? 'h-full' : 'p-8 min-h-full'}>
              <LoginGate>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/album/:id" element={<Album />} />
                  <Route path="/playlist/new" element={<NewPlaylist />} />
                  <Route path="/playlist/:id" element={<Playlist />} />
                  <Route path="/now-playing" element={<NowPlaying />} />
                  <Route path="/lyrics" element={<Lyrics />} />
                  <Route path="/liked" element={<Liked />} />
                  <Route path="/radio" element={<Radio />} />
                  <Route path="/artist/:id" element={<Artist />} />
                </Routes>
              </LoginGate>
            </div>
          </main>
          {!immersive && <NowPlayingBar />}
          <Toasts />
        </div>
      </LayoutGroup>
    </ContextMenuProvider>
  )
}

function MiniPlayerApp() {
  useArtColors()
  useSyncAndPresence({ isMiniPlayer: true })
  return <MiniPlayer />
}

function useRestoreLikes() {
  const setLiked = usePlayer((s) => s.setLiked)
  useEffect(() => {
    window.bombo.store.get<Record<string, boolean>>('likedIds').then((v) => {
      if (v) setLiked(v)
    })
  }, [setLiked])
}

function useFullScreen() {
  const [value, setValue] = useState(false)
  useEffect(() => {
    // Seed from the current state (if we mounted mid-fullscreen), then
    // listen for changes pushed from the main process.
    window.bombo.window.isFullScreen().then((v) => setValue(!!v))
    return window.bombo.window.onFullScreenChange(setValue)
  }, [])
  return value
}
