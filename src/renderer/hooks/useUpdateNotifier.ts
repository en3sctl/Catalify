import { useEffect } from 'react'
import { toast } from '../store/toast'

/**
 * Bridges electron-updater events from the main process into toast UI.
 *
 * Behaviour:
 *   • "update-available"  → silent info toast "Downloading v…".
 *   • "update-downloaded" → handled by <UpdateBanner/> (a Discord-style
 *                           top-right card with a one-click Restart button),
 *                           so we deliberately do NOT toast it here.
 *   • Errors              → logged (only network noise is swallowed).
 *
 * The updater only runs in packaged builds (main-process side short-
 * circuits in dev), so in `npm run dev` this hook is effectively a no-op
 * even though the listeners are attached.
 */
export function useUpdateNotifier() {
  useEffect(() => {
    const api = (window as any).bombo?.updater
    if (!api) return

    const offAvailable = api.onUpdateAvailable(({ version }: { version: string | null }) => {
      toast.info(
        'Update available',
        `Downloading Çatalify ${version ?? ''} in the background…`,
      )
    })

    const offError = api.onError(({ message }: { message: string }) => {
      // Don't spam — only surface if it's something actionable.
      if (/ENOTFOUND|ETIMEDOUT|network/i.test(message)) return
      console.warn('[updater] error surfaced:', message)
    })

    return () => {
      offAvailable?.()
      offError?.()
    }
  }, [])
}
