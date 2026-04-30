export {}

declare global {
  interface Window {
    bombo: {
      getDeveloperToken: () => Promise<string>
      getStorefront: () => Promise<string>
      store: {
        get: <T = unknown>(key: string) => Promise<T>
        set: (key: string, value: unknown) => Promise<boolean>
        delete: (key: string) => Promise<boolean>
      }
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
        toggleFullScreen: () => void
        isFullScreen: () => Promise<boolean>
        onFullScreenChange: (cb: (value: boolean) => void) => () => void
      }
      miniPlayer: {
        open: () => void
        close: () => void
      }
      thumbar: {
        update: (payload: { isPlaying: boolean; hasTrack: boolean; icons?: any }) => void
      }
      discord: {
        update: (payload: any) => void
        clear: () => void
      }
      sync: {
        broadcast: (msg: any) => void
        onMessage: (cb: (msg: any) => void) => () => void
      }
      onShortcut: (cb: (action: string) => void) => () => void
      updater: {
        installNow: () => void
        checkNow: () => Promise<{ ok: boolean; version?: string | null; error?: string }>
        onUpdateAvailable: (cb: (info: { version: string | null }) => void) => () => void
        onDownloadProgress: (cb: (info: { percent: number; transferred: number; total: number }) => void) => () => void
        onUpdateDownloaded: (cb: (info: { version: string | null }) => void) => () => void
        onError: (cb: (info: { message: string }) => void) => () => void
      }
    }
    MusicKit: any
  }
}
