
# Audio Player

A desktop audio player and organiser for long-form spoken-word content —
podcasts, lectures, audiobooks, interviews, meeting recordings, voice memos.

Its two defining features: **resume that never forgets**, and **Voice Boost**,
a single toggle tuned for speech intelligibility.

Built with Electron, React 18, TypeScript, and sql.js (SQLite compiled to
WebAssembly). No native modules, no external services, no cloud.

---

## Features

### Resume that never forgets

Every file remembers its last playback position. Every playlist remembers
which entry was playing. Close the app, restart your machine, rescan the
library — none of it touches your saved positions.

- **Per-file resume.** A file resumes from where you stopped it, regardless
  of how you reach it.
- **Per-playlist cursor.** Each playlist remembers which entry was last
  playing. Opening the playlist highlights it. A Resume button plays it.
- **Auto-advance stays in context.** A track that ends in a playlist advances
  to the next playlist entry, not the next library track.

### Playlists

Create, rename, delete, reorder. Add tracks via right-click. The playlist
cursor survives restarts. Drag entries to change the order.

### Voice Boost

A single toggle for speech intelligibility. A high-pass filter at 80 Hz
removes rumble, a presence peak at 2.5 kHz lifts consonants, and a
compressor evens out volume differences between speakers and rooms.
Automatically disabled during video playback.

### Playback speed

0.75× to 2.0×, with pitch preserved. The setting persists across tracks
and sessions.

### Folder library

Add folders once, scan them, and the library stays in sync. The scan is
incremental — only changed files are re-parsed. Adding a file and rescanning
picks it up; deleting a file removes it.

### Filters

- **Folder filter.** Click a folder in the sidebar to filter the library to
  just that folder's tracks. Click again to clear.
- **Media type filter.** All / Audio / Video segmented control in the library
  header.
- **Natural sort.** Filenames sort naturally: `1, 2, 3, ..., 10, 11, ...`
  instead of `1, 10, 11, 2, ...`.

### Video playback

Video files (MP4, M4V, WebM, some MKV) appear in the library and play in a
panel above the track list. Fullscreen and picture-in-picture supported.
Resume, playlists, and the cursor system work for video unchanged.

### Keyboard and OS integration

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `←` / `→` | Seek ±10 seconds |
| `↑` / `↓` | Seek ±10 seconds |

OS media keys (play/pause, next track) work through the system media session.

---

## Installation

### From a release (recommended)

1. Go to the [Releases](../../releases) page.
2. Download the latest `audio-player-x.y.z-setup.exe`.
3. Run the installer. It installs to `%LOCALAPPDATA%\Programs\audio-player`.
4. Launch from the Start Menu or the desktop shortcut.

Windows will show a SmartScreen warning because the installer is not
code-signed. Click **More info** → **Run anyway**.

### First run

1. Click **Add folder** and pick a directory containing audio (or video)
   files.
2. Wait for the scan to complete. Tracks appear in the library.
3. Click a track to play it.

The library database is stored at:

```
%APPDATA%\audio-player\library.db
```

Uninstalling and reinstalling does not delete it. Your library, playlists,
and resume positions survive version upgrades in place.

### System requirements

- Windows 10 or later (64-bit)
- ~200 MB of disk space for the application
- Additional space for the library database, proportional to library size

---

## Supported formats

**Audio:** MP3, FLAC, M4A, AAC, OGG, Opus, WAV, WMA, AIFF.

**Video:** MP4 (H.264 + AAC), WebM (VP8/VP9/AV1 + Opus/Vorbis). MKV support
is inconsistent — some codec combinations play, others don't.

Playback is limited to what Chromium's decoder supports natively. APE, DSD,
H.265/HEVC on some platforms, and some ALAC variants are not supported.

---

## Development

### Prerequisites

- Node.js 20 or 22 LTS
- npm

### Setup

```bash
git clone <your-repo-url>
cd audio-player
npm install
```

### Run in development

```bash
npm run dev
```

Launches Electron with a Vite dev server for the renderer. Renderer edits
hot-reload; main-process edits require a restart.

### Type-check

```bash
npm run typecheck
```

### Build the installer

```bash
npm run build:win
```

Produces `dist/audio-player-x.y.z-setup.exe` and `dist/win-unpacked/`. The
unpacked folder is a runnable copy of the app — useful for testing before
packaging.

To test the built app without building the installer:

```bash
npm run start
```

### Version bumps

Edit `version` in `package.json`. Everything else — the installer name, the
embedded app version, the Windows "Add/Remove Programs" entry — derives
from it.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node.js + TypeScript)                         │
│                                                             │
│  • BrowserWindow                                            │
│  • sql.js database + debounced persistence                  │
│  • Filesystem walking + metadata parsing                    │
│  • Custom media:// protocol for serving files               │
│  • IPC handlers                                             │
│                                                             │
└───────────────────────────┬─────────────────────────────────┘
                            │ IPC (contextBridge)
┌───────────────────────────┴─────────────────────────────────┐
│ PRELOAD (TypeScript)                                        │
│  • Narrow, typed API surface exposed as window.api          │
└───────────────────────────┬─────────────────────────────────┘
                            │ window.api.*
┌───────────────────────────┴─────────────────────────────────┐
│ RENDERER (React + TypeScript)                               │
│                                                             │
│  CONTROLLER LAYER (module singletons, outside React)        │
│   • mediaController — owns the <video> element              │
│   • audioGraph      — owns the Web Audio graph              │
│   • resumeTracker   — throttles position saves              │
│   • scanListener    — subscribes to main scan events        │
│                                                             │
│  ZUSTAND STORE                                              │
│   librarySlice · playlistsSlice · playerSlice               │
│   foldersSlice · settingsSlice · scanSlice · uiSlice        │
│                                                             │
│  REACT COMPONENTS                                           │
│   <MediaSurface> <PlayerBar> <LibraryView> <PlaylistView>   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key architectural decisions

**The media element and Web Audio graph live outside React.** React mounts
a container; the controller attaches its `<video>` element to it. This is
required because `createMediaElementSource` binds permanently to one
element, and React can re-mount components. The element's lifetime is the
app's lifetime, not the component's.

**The renderer never touches the filesystem or database.** All I/O happens
in the main process. The preload exposes a small typed API via
`contextBridge`. Every IPC handler validates its inputs at runtime.

**The database is a single WASM file.** `sql.js` compiles SQLite to
WebAssembly. There's no native module, no `electron-rebuild`, no platform
build issues. The trade-off is manual persistence: the database lives in
memory, and `db.export()` serializes the whole thing to disk. Writes are
debounced at 500 ms and flushed on scan completion and app quit.

**Media is served via a custom `media://` protocol.** The protocol handler
implements HTTP Range requests, which `<video>` needs for seeking. It also
declares `corsEnabled: true`, which `createMediaElementSource` requires to
avoid "outputs zeroes due to CORS" silent audio.

### Project layout

```
src/
├── main/                # Main process (Node)
│   ├── index.ts         # App lifecycle, protocol, window
│   ├── db.ts            # sql.js + schema + queries
│   ├── scanner.ts       # Folder walk + metadata parse
│   ├── playlists.ts     # Playlist CRUD
│   └── ipc.ts           # IPC handler registration
│
├── preload/             # contextBridge
│   ├── index.ts
│   └── index.d.ts       # Global Window augmentation
│
├── shared/              # Types used by all three processes
│   └── api.ts
│
└── renderer/            # React app
    └── src/
        ├── controllers/ # Imperative singletons
        ├── store/       # Zustand slices
        ├── hooks/       # Custom hooks
        ├── components/  # React components
        ├── utils/       # Format helpers
        └── styles/
```

### Data model

Two tables matter most: `tracks` (with `position` for resume and `media_type`
for audio/video) and `playlists` (with `current_entry_id` for the cursor).
`playlist_tracks` is the join table with `sort_order` for reordering. A
`settings` table holds scalar state.

The scanner's upsert writes tag fields but **never** touches `position` or
`position_updated`. This is the single most important schema constraint —
it's what keeps resume state alive across rescans.

---

## Known limitations

- **Windows only.** The code is cross-platform by design (Electron), but
  builds and testing have been done only for Windows.
- **No search.** The folder and media filters are the only navigation tools.
- **No folder watching.** New files appear after clicking Rescan, not
  automatically.
- **Large libraries** above ~5,000 visible tracks may render slowly.
  Virtual scrolling is not implemented.
- **No subtitle support** for video. Sidecar `.srt`/`.vtt` files are
  ignored.
- **No code-signing.** Windows SmartScreen warns on first launch.

---

## What it deliberately doesn't do

This app is minimal on purpose. The following are not oversights:

- No search or filtering by metadata tags
- No cover art
- No streaming, cloud, or network features
- No statistics or listening history
- No multi-band equaliser
- No crossfade or ReplayGain
- No import/export of playlists

It plays your local files and remembers where you left off. That's the
whole job.

