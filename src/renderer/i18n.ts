import { useSettings } from './store/settings'

/**
 * Minimal in-house i18n — a flat EN/TR dictionary and a `useT()` hook.
 * No runtime deps, no pluralization engine; strings with a variable use
 * `{n}`-style placeholders that callers `.replace()` themselves.
 *
 * Coverage: chrome surfaces (sidebar, queue, sleep timer, notifications,
 * lyrics, settings, home rails). Deeper pages fall back to English.
 */
const en = {
  // Sidebar
  navHome: 'Home',
  navSearch: 'Search',
  navLibrary: 'Library',
  navRadio: 'Radio',
  navLiked: 'Liked',
  navFriends: 'Friends',
  navStats: 'Stats',
  friendsListening: 'Friends listening',
  viewProfile: 'View profile',
  setUpProfile: 'Set up profile',
  connecting: 'Connecting…',
  signInApple: 'Sign in with Apple Music',
  now: 'now',

  // Queue drawer
  queueTitle: 'Up next',
  nowPlayingSection: 'Now playing',
  queueSection: 'Queue',
  queueEmpty: 'Queue is empty.',
  moreInQueue: '+{n} more in queue',
  addedManually: 'Added to queue manually',
  dragToReorder: 'Drag to reorder',
  remove: 'Remove',

  // Sleep timer
  sleepTimer: 'Sleep timer',
  stopPlaybackIn: 'Stop playback in',
  minutesShort: '{n} minutes',
  cancelTimer: 'Cancel timer',

  // Notifications
  notifications: 'Notifications',
  nothingYet: 'Nothing yet.',
  startedFollowing: 'started following you',
  reactedTo: 'reacted',

  // Lyrics
  playSomethingLyrics: 'Play something to see lyrics.',
  loadingLyrics: 'Loading lyrics…',
  noLyricsFound: 'No lyrics found on lrclib or Apple Music for this track.',
  noLyrics: 'No lyrics found.',
  unsyncedLyrics: 'Unsynced lyrics',

  // Home
  greetingLateNight: 'Late night',
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  newFromArtists: 'New from artists you follow',
  newFromArtistsSub: 'Fresh releases from your people',
  madeForYou: 'Made for you',
  madeForYouSub: 'Apple Music picks based on what you play',
  top100: 'Top 100 right now',
  top100Sub: "What's charting on Apple Music today",
  trendingAlbums: 'Trending albums',
  trendingAlbumsSub: 'Most-played in your storefront',
  fromYourLibrary: 'From your library',
  fromYourLibrarySub: "Songs you've saved in Apple Music",
  recentlyPlayed: 'Recently played',
  recentlyPlayedSub: 'Jump right back in',
  editorsPicks: "Editor's picks",
  editorsPicksSub: 'Featured playlists right now',
  yourPlaylists: 'Your playlists',
  yourPlaylistsSub: 'From your Apple Music library',
  onRepeat: 'On repeat',
  onRepeatSub: 'Your heavy rotation',
  recentlyAdded: 'Recently added',
  recentlyAddedSub: 'Fresh in your library',

  // Avatar crop
  cropAvatar: 'Crop photo',
  cancel: 'Cancel',
  save: 'Save',

  // Badges
  badges: 'Badges',
  badgesHint: 'Earned by listening. Click a badge to show or hide it on your profile.',
  badgeH10: 'Warming Up',
  badgeH10Desc: '10 hours listened',
  badgeH50: 'Relentless Listener',
  badgeH50Desc: '50 hours listened',
  badgeH100: 'No Off Switch',
  badgeH100Desc: '100 hours listened',
  badgeExplorer: 'Explorer',
  badgeExplorerDesc: '50 different artists',
  badgeSuperfan: 'Superfan',
  badgeSuperfanDesc: '100 listens of a single artist',
  badgeNightowl: 'Night Owl',
  badgeNightowlDesc: '50 late-night listens',
  badgeEarlybird: 'Early Bird',
  badgeEarlybirdDesc: '30 early-morning listens',
  badgeFinisher: 'Finisher',
  badgeFinisherDesc: 'Finishes 80% of songs',
  badgeStreak7: 'On a Streak',
  badgeStreak7Desc: '7 days in a row',
  badgeRegular: 'Regular',
  badgeRegularDesc: '500 songs played',
  badgeRepeat: 'Repeat Offender',
  badgeRepeatDesc: 'One song, 25+ plays',
  badgeMarathon: 'Marathoner',
  badgeMarathonDesc: '4 hours in a single day',
  badgeWeekend: 'Weekend Warrior',
  badgeWeekendDesc: '100 weekend listens',
  badgeCollector: 'Collector',
  badgeCollectorDesc: '300 different songs',
  badgeVeteran: 'Veteran',
  badgeVeteranDesc: 'Active on 30 different days',
  badgeShow: 'Show on profile',
  badgeHide: 'Hide from profile',
  badgesMore: 'more',

  // Settings
  settingsKicker: 'Settings',
  preferences: 'Preferences',
  backToProfile: 'Back to profile',
  appearance: 'Appearance',
  appearanceSub: 'Language and how Çatalify looks.',
  language: 'Language',
  languageDesc: 'Interface language. Song and album data follows Apple Music.',
  theme: 'Theme',
  themeAdaptive: 'Adaptive',
  themeAdaptiveDesc: 'Colors follow the current album art — the signature look.',
  themeDark: 'Dark',
  themeDarkDesc: 'Static dark theme with a fixed warm accent.',
  themeLight: 'Light',
  themeLightDesc: 'Light surfaces, dark text.',
  contentTitle: 'Content',
  contentSub: 'What can show up across Çatalify.',
  allowExplicit: 'Allow explicit content',
  allowExplicitDesc:
    'When off, songs and albums marked “explicit” are hidden from every list — and won\'t enter the play queue either.',
  privacyTitle: 'Privacy',
  privacySub: 'Control what other Çatalify users will see when social features ship.',
  publicProfile: 'Public profile',
  publicProfileDesc: 'Let other people find your profile by username.',
  listeningActivity: 'Show listening activity',
  listeningActivityDesc: "Friends can see what you're playing right now. Off matches Apple Music's default.",
  followedArtistsSetting: 'Show followed artists',
  followedArtistsDesc: 'Hide your Following grid from your profile.',
  showPlaylists: 'Show playlists',
  showPlaylistsDesc: 'Let friends browse your saved playlists.',
  advanced: 'Advanced',
  advancedHint: 'Power-user options & external tools',
  storedLocally:
    'Settings are stored locally on this device. They sync across Çatalify windows but not to other computers.',
}

const tr: Record<TKey, string> = {
  navHome: 'Ana sayfa',
  navSearch: 'Ara',
  navLibrary: 'Kitaplık',
  navRadio: 'Radyo',
  navLiked: 'Beğenilenler',
  navFriends: 'Arkadaşlar',
  navStats: 'İstatistikler',
  friendsListening: 'Arkadaşlar dinliyor',
  viewProfile: 'Profili görüntüle',
  setUpProfile: 'Profil oluştur',
  connecting: 'Bağlanıyor…',
  signInApple: 'Apple Music ile giriş yap',
  now: 'şimdi',

  queueTitle: 'Sıradakiler',
  nowPlayingSection: 'Şimdi çalıyor',
  queueSection: 'Kuyruk',
  queueEmpty: 'Kuyruk boş.',
  moreInQueue: 'Kuyrukta +{n} şarkı daha',
  addedManually: 'Kuyruğa elle eklendi',
  dragToReorder: 'Sürükleyip sırala',
  remove: 'Kaldır',

  sleepTimer: 'Uyku zamanlayıcısı',
  stopPlaybackIn: 'Çalmayı durdur',
  minutesShort: '{n} dakika',
  cancelTimer: 'Zamanlayıcıyı iptal et',

  notifications: 'Bildirimler',
  nothingYet: 'Henüz bir şey yok.',
  startedFollowing: 'seni takip etmeye başladı',
  reactedTo: 'tepki verdi',

  playSomethingLyrics: 'Sözleri görmek için bir şey çal.',
  loadingLyrics: 'Sözler yükleniyor…',
  noLyricsFound: 'Bu şarkı için lrclib veya Apple Music’te söz bulunamadı.',
  noLyrics: 'Söz bulunamadı.',
  unsyncedLyrics: 'Senkronsuz sözler',

  greetingLateNight: 'Gecenin bir yarısı',
  greetingMorning: 'Günaydın',
  greetingAfternoon: 'İyi günler',
  greetingEvening: 'İyi akşamlar',
  newFromArtists: 'Takip ettiğin sanatçılardan yeni',
  newFromArtistsSub: 'Senin sanatçılarından taze çıkışlar',
  madeForYou: 'Senin için',
  madeForYouSub: 'Dinlediklerine göre Apple Music seçimleri',
  top100: 'Şu an Top 100',
  top100Sub: 'Apple Music’te bugün liste başı olanlar',
  trendingAlbums: 'Trend albümler',
  trendingAlbumsSub: 'Bölgende en çok dinlenenler',
  fromYourLibrary: 'Kitaplığından',
  fromYourLibrarySub: 'Apple Music’e kaydettiğin şarkılar',
  recentlyPlayed: 'Son çalınanlar',
  recentlyPlayedSub: 'Kaldığın yerden devam et',
  editorsPicks: 'Editör seçimleri',
  editorsPicksSub: 'Öne çıkan çalma listeleri',
  yourPlaylists: 'Çalma listelerin',
  yourPlaylistsSub: 'Apple Music kitaplığından',
  onRepeat: 'Tekrar tekrar',
  onRepeatSub: 'Düşmediğin şarkılar',
  recentlyAdded: 'Son eklenenler',
  recentlyAddedSub: 'Kitaplığında en yeniler',

  cropAvatar: 'Fotoğrafı kırp',
  cancel: 'Vazgeç',
  save: 'Kaydet',

  badges: 'Rozetler',
  badgesHint: 'Dinledikçe kazanılır. Profilinde göstermek ya da gizlemek için rozete tıkla.',
  badgeH10: 'Isınma Turu',
  badgeH10Desc: '10 saat dinleme',
  badgeH50: 'Amansız Dinleyici',
  badgeH50Desc: '50 saat dinleme',
  badgeH100: 'Kapanmak Bilmez',
  badgeH100Desc: '100 saat dinleme',
  badgeExplorer: 'Kaşif',
  badgeExplorerDesc: '50 farklı sanatçı',
  badgeSuperfan: 'Hayranın Dibi',
  badgeSuperfanDesc: 'Tek sanatçıdan 100 dinleme',
  badgeNightowl: 'Gece Kuşu',
  badgeNightowlDesc: 'Gece yarısı 50 dinleme',
  badgeEarlybird: 'Erkenci Kuş',
  badgeEarlybirdDesc: 'Sabahın köründe 30 dinleme',
  badgeFinisher: 'Şarkı Bitirici',
  badgeFinisherDesc: 'Şarkıların %80’ini sonuna kadar dinler',
  badgeStreak7: 'Seri Halinde',
  badgeStreak7Desc: 'Üst üste 7 gün',
  badgeRegular: 'Müdavim',
  badgeRegularDesc: '500 şarkı çalındı',
  badgeRepeat: 'Repeat Suçlusu',
  badgeRepeatDesc: 'Tek şarkı, 25+ dinleme',
  badgeMarathon: 'Maratoncu',
  badgeMarathonDesc: 'Tek günde 4 saat',
  badgeWeekend: 'Hafta Sonu Savaşçısı',
  badgeWeekendDesc: 'Hafta sonu 100 dinleme',
  badgeCollector: 'Koleksiyoncu',
  badgeCollectorDesc: '300 farklı şarkı',
  badgeVeteran: 'Emektar',
  badgeVeteranDesc: '30 farklı günde aktif',
  badgeShow: 'Profilde göster',
  badgeHide: 'Profilden gizle',
  badgesMore: 'daha',

  settingsKicker: 'Ayarlar',
  preferences: 'Tercihler',
  backToProfile: 'Profile dön',
  appearance: 'Görünüm',
  appearanceSub: 'Dil ve Çatalify’ın görünümü.',
  language: 'Dil',
  languageDesc: 'Arayüz dili. Şarkı ve albüm bilgileri Apple Music’ten gelir.',
  theme: 'Tema',
  themeAdaptive: 'Adaptif',
  themeAdaptiveDesc: 'Renkler çalan albümün kapağına uyum sağlar — imza görünüm.',
  themeDark: 'Koyu',
  themeDarkDesc: 'Sabit sıcak vurgulu statik koyu tema.',
  themeLight: 'Açık',
  themeLightDesc: 'Açık yüzeyler, koyu metin.',
  contentTitle: 'İçerik',
  contentSub: 'Çatalify genelinde nelerin görünebileceği.',
  allowExplicit: 'Müstehcen içeriğe izin ver',
  allowExplicitDesc:
    'Kapalıyken “explicit” işaretli şarkı ve albümler hiçbir listede görünmez, çalma kuyruğuna da girmez.',
  privacyTitle: 'Gizlilik',
  privacySub: 'Sosyal özellikler geldiğinde diğer Çatalify kullanıcılarının ne göreceğini yönet.',
  publicProfile: 'Herkese açık profil',
  publicProfileDesc: 'Diğer kişiler profilini kullanıcı adınla bulabilsin.',
  listeningActivity: 'Dinleme etkinliğini göster',
  listeningActivityDesc:
    'Arkadaşların şu an ne çaldığını görebilir. Kapalı olması Apple Music varsayılanıyla aynı.',
  followedArtistsSetting: 'Takip edilen sanatçıları göster',
  followedArtistsDesc: 'Takip ettiklerin profilinde görünmesin.',
  showPlaylists: 'Çalma listelerini göster',
  showPlaylistsDesc: 'Arkadaşların kayıtlı çalma listelerine göz atabilsin.',
  advanced: 'Gelişmiş',
  advancedHint: 'İleri düzey seçenekler ve harici araçlar',
  storedLocally:
    'Ayarlar bu cihazda yerel olarak saklanır. Çatalify pencereleri arasında eşitlenir ama başka bilgisayarlara aktarılmaz.',
}

export type TKey = keyof typeof en
const dict: Record<'en' | 'tr', Record<TKey, string>> = { en, tr }

/**
 * Rotating hero headlines for Home — one pool per player state, picked at
 * random so the big line isn't the same sentence forever. Kept out of the
 * flat dict because they're arrays.
 */
export const heroLines: Record<'en' | 'tr', { playing: string[]; resume: string[]; fresh: string[] }> = {
  en: {
    playing: [
      'Keep the flow going.',
      "Don't stop now.",
      'Stay in the groove.',
      'Lost in the sound.',
      'This one hits right.',
    ],
    resume: [
      'Pick up where you left off.',
      'Right where you paused.',
      'Your soundtrack is waiting.',
      'Back for one more?',
    ],
    fresh: [
      'What will you play today?',
      'Set the mood.',
      'Find your next favorite.',
      'Silence is overrated.',
    ],
  },
  tr: {
    playing: [
      'Akış devam etsin.',
      'Şimdi durma.',
      'Ritmi bırakma.',
      'Sesin içinde kaybol.',
      'Bu şarkı tam yerine oturdu.',
    ],
    resume: [
      'Kaldığın yerden devam et.',
      'Tam bıraktığın yerdesin.',
      'Müziğin seni bekliyor.',
      'Bir tane daha?',
    ],
    fresh: [
      'Bugün ne çalacaksın?',
      'Modunu ayarla.',
      'Sıradaki favorini bul.',
      'Sessizlik abartılıyor.',
    ],
  },
}

/** Hook variant — re-renders the component when the language changes. */
export function useT() {
  const lang = useSettings((s) => s.lang)
  return (key: TKey) => dict[lang][key] ?? en[key] ?? key
}

/** Non-reactive variant for code outside components. */
export function t(key: TKey): string {
  const lang = useSettings.getState().lang
  return dict[lang][key] ?? en[key] ?? key
}
