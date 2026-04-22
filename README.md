# BomboMusic

A personal, minimal Apple Music desktop player for Windows. Dark. Fast. Colored by what's playing.

> This is an unreleased, single-user project. Do **not** share your `.p8` key or signed builds.

## First-time setup

1. **Fill in `.env`** (copy from `.env.example`):

   ```
   APPLE_TEAM_ID=XXXXXXXXXX            # 10-char Team ID from https://developer.apple.com/account (Membership)
   APPLE_KEY_ID=BQJDU99MSG             # matches AuthKey_<KEY_ID>.p8
   APPLE_PRIVATE_KEY_PATH=./AuthKey_BQJDU99MSG.p8
   ```

2. **Install dependencies** (this downloads the castlabs Electron build that has Widevine CDM):

   ```bash
   npm install
   ```

3. **Run in dev mode**:

   ```bash
   npm run dev
   ```

   This runs Vite on `localhost:5173` + Electron pointed at it.

4. **First launch**: click **Sign in to Apple Music** in the sidebar. A popup opens where you sign into your Apple ID; after that the app has full catalog + library access.

## Build a Windows installer

```bash
npm run package
```

Result appears in `release/` as `BomboMusic-Setup-<version>.exe`. Standard NSIS installer — runs like any Windows app. The `.p8` key is bundled into the installer's `resources/` folder.

## Features

- Apple Music sign-in (OAuth via MusicKit JS)
- Full catalog playback (requires active Apple Music subscription)
- Home, Search, Library, Album, Playlist pages
- Dedicated Now Playing view with vinyl halo + breathing glow
- Dynamic accent color extracted from the current album art
- Shuffle, repeat (off / all / one)
- Global media keys (Play/Pause, Next, Previous)
- Volume + shuffle + repeat state persists across launches
- Dark minimal "Obsidian" theme with subtle noise texture

## Folder layout

```
src/
  main/           ← Electron main process (Node)
    main.ts            ← app bootstrap, window creation, IPC
    preload.ts         ← secure bridge to renderer (window.bombo.*)
    developer-token.ts ← JWT generation from .p8
    store.ts           ← electron-store persistence
  renderer/       ← React UI
    pages/             ← Home, Search, Library, Album, Playlist, NowPlaying
    components/        ← TitleBar, Sidebar, NowPlayingBar, TrackRow, …
    hooks/             ← useMusicKit, useArtColors
    store/             ← Zustand player store
    utils/             ← musickit-api, color-extract, format
    styles/            ← globals.css (Tailwind + theme)
```

## Security notes

- `.p8`, `.env`, `secrets/` are gitignored. Never check these in.
- The developer token is generated in the main process and passed to the renderer via IPC. It's signed with ES256 and valid for ~150 days, cached in memory.
- The user's Apple Music user token is stored via `electron-store` (in `%APPDATA%/bombomusic/`).

## Troubleshooting

- **"MusicKit JS failed to load"** → check your network; the script comes from `js-cdn.music.apple.com`.
- **Sign-in popup blocked** → make sure you didn't click through Windows SmartScreen warnings; the window uses system Chromium.
- **No audio on Apple Music tracks** → Widevine CDM isn't loaded. Confirm `electron` installed from `@castlabs/electron-releases` (check `node_modules/electron/package.json`).
- **Token regeneration** → delete `%APPDATA%/bombomusic/config.json` to clear the user token and re-sign-in.

## Roadmap (update-by-update)

- Lyrics panel (time-synced)
- Mini-player mode
- Discord Rich Presence
- Custom global hotkeys
- Equalizer
- System tray + background playback
- Queue reordering (drag & drop)
- Crossfade
