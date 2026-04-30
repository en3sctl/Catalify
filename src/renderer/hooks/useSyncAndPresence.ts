import { useEffect, useRef } from 'react'
import { usePlayer } from '../store/player'
import { getThumbarIcons } from '../utils/thumbar-icons'

type PlayerSnap = ReturnType<typeof usePlayer.getState>

function pushState(s: PlayerSnap) {
  if (s.nowPlaying) {
    // Resolve a public Apple Music URL for the "Listen on Apple Music"
    // button. Falls back to 'us' if MusicKit hasn't surfaced a
    // storefront yet (rare — would require pre-auth track playback).
    const sf =
      (window as any).MusicKit?.getInstance?.()?.storefrontId || 'us'
    const appleMusicUrl = `https://music.apple.com/${sf}/song/${s.nowPlaying.id}`
    window.bombo.discord.update({
      title: s.nowPlaying.title,
      artist: s.nowPlaying.artistName,
      album: s.nowPlaying.albumName,
      artworkUrl: s.nowPlaying.artworkUrl,
      appleMusicUrl,
      durationMs: s.durationMs,
      progressMs: s.progressMs,
      isPlaying: s.isPlaying,
    })
  } else {
    window.bombo.discord.clear()
  }
  window.bombo.sync.broadcast({
    type: 'state',
    nowPlaying: s.nowPlaying,
    isPlaying: s.isPlaying,
    progressMs: s.progressMs,
    durationMs: s.durationMs,
    volume: s.volume,
  })
}

/**
 * Publishes now-playing state to Discord Rich Presence and mirrors it across
 * Electron windows (main ↔ mini-player). Any window can issue commands
 * (toggle/next/previous/seek) and they'll be applied on the sending window;
 * state updates flow from the source window to the others.
 */
export function useSyncAndPresence({ isMiniPlayer = false } = {}) {
  const lastPushed = useRef(0)

  useEffect(() => {
    // Listen for commands from other windows (mini-player → main, etc.)
    const off = window.bombo.sync.onMessage((msg) => {
      const p = usePlayer.getState()
      if (msg.type === 'cmd:toggle') p.toggle()
      else if (msg.type === 'cmd:next') p.next()
      else if (msg.type === 'cmd:previous') p.previous()
      else if (msg.type === 'cmd:seek') p.seek(msg.ms)
      else if (msg.type === 'cmd:volume') p.setVolume(msg.value)
      else if (msg.type === 'state' && isMiniPlayer) {
        // Mini-player only mirrors state from main; it never drives MusicKit itself
        usePlayer.setState({
          nowPlaying: msg.nowPlaying,
          isPlaying: msg.isPlaying,
          progressMs: msg.progressMs,
          durationMs: msg.durationMs,
          volume: msg.volume,
        })
      }
    })
    return off
  }, [isMiniPlayer])

  // From main window only: push state to mini-player + Discord + taskbar
  useEffect(() => {
    if (isMiniPlayer) return
    const lastThumbar = { isPlaying: false, hasTrack: false }
    const lastTransport = {
      isPlaying: usePlayer.getState().isPlaying,
      nowPlayingId: usePlayer.getState().nowPlaying?.id ?? null,
    }
    const unsub = usePlayer.subscribe((s) => {
      // Thumbar updates are cheap; push whenever transport state actually flips
      const hasTrack = !!s.nowPlaying
      if (s.isPlaying !== lastThumbar.isPlaying || hasTrack !== lastThumbar.hasTrack) {
        lastThumbar.isPlaying = s.isPlaying
        lastThumbar.hasTrack = hasTrack
        window.bombo.thumbar.update({
          isPlaying: s.isPlaying,
          hasTrack,
          icons: getThumbarIcons(),
        })
      }

      // Transport-state changes (play/pause, track switch) MUST flow through
      // immediately or the mini-player's play/pause icon gets stuck showing
      // the old state while the progress-tick throttle below swallows it.
      const transportFlipped =
        s.isPlaying !== lastTransport.isPlaying ||
        (s.nowPlaying?.id ?? null) !== lastTransport.nowPlayingId
      if (transportFlipped) {
        lastTransport.isPlaying = s.isPlaying
        lastTransport.nowPlayingId = s.nowPlaying?.id ?? null
        pushState(s)
        lastPushed.current = Date.now()
        return
      }

      // Throttle the rest (progress ticks every 150 ms) to keep Discord +
      // sync bandwidth reasonable.
      const now = Date.now()
      if (now - lastPushed.current < 900) return
      lastPushed.current = now
      pushState(s)
    })
    return unsub
  }, [isMiniPlayer])
}
