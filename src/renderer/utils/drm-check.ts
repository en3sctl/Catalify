import { toast } from '../store/toast'

/**
 * Probe the Encrypted Media Extensions API to find out which DRM systems
 * are actually available in this Electron build. Apple Music catalog
 * streaming requires Widevine (Chromium-based); FairPlay is Safari-only.
 */
export async function diagnoseDRM(options: { silentOnSuccess?: boolean } = {}) {
  const results: Record<string, string> = {}
  const systems = [
    'com.widevine.alpha',
    'com.apple.fps',
    'com.apple.fps.1_0',
    'com.microsoft.playready',
  ]

  for (const system of systems) {
    try {
      const access = await navigator.requestMediaKeySystemAccess(system, [
        {
          initDataTypes: ['cenc', 'keyids', 'webm'],
          audioCapabilities: [
            { contentType: 'audio/mp4; codecs="mp4a.40.2"', robustness: 'SW_SECURE_CRYPTO' },
            { contentType: 'audio/webm; codecs="opus"', robustness: 'SW_SECURE_CRYPTO' },
          ],
          videoCapabilities: [
            { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'SW_SECURE_DECODE' },
          ],
        },
      ])
      results[system] = '✅ available'
      console.log(`[DRM] ${system}: available`, access.keySystem)
    } catch (err: any) {
      results[system] = `❌ ${err?.message || 'not supported'}`
      console.warn(`[DRM] ${system}: NOT available — ${err?.message}`)
    }
  }

  const widevineOK = results['com.widevine.alpha']?.startsWith('✅')
  const fairplayOK = Object.keys(results).some(
    (k) => k.includes('apple.fps') && results[k].startsWith('✅')
  )

  if (!widevineOK && !fairplayOK) {
    toast.error(
      'DRM not available',
      'Widevine and FairPlay are both missing in this Electron build. Apple Music streams will fail until Widevine is installed. First launch may still be downloading it — try again in 30-60 seconds.',
    )
  } else if (widevineOK && !options.silentOnSuccess) {
    // Don't spam success toasts — only log
    console.log('[DRM] Widevine ready ✓')
  }

  return { widevineOK, fairplayOK, results }
}
