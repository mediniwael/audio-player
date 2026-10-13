# Audio Player & Organiser — Design Document

**Version:** 2.0
**Status:** Design / pre-implementation
**Target platform:** Windows (primary); macOS and Linux supported by the stack but untested in v1
**Stack:** Electron + React + TypeScript + Vite + sql.js

---

## 1. Overview

A desktop audio player and organiser built for **long-form spoken-word content** — podcasts, lectures, audiobooks, interviews, meeting recordings, voice memos. The user designates specific folders as their library roots. The app scans only those folders, indexes the files into a local SQLite database, and provides playback, playlists, and a resume system that remembers exactly where the user left off — per file, and per playlist.

Two features define the app:

1. **Resume that never forgets.** Every file remembers its playback position. Every playlist remembers which entry was last playing. Closing the app, restarting the machine, or rescanning the library never loses this state.
2. **Voice Boost.** A single toggle that improves speech intelligibility through a Web Audio chain tuned for spoken content.

The app is deliberately minimal in scope. It has no search, no metadata browsing, no cover art, no statistics, and no cloud features. It does one thing — long-form audio with reliable resume — and does it well.

---

## 2. Goals and Non-goals

### Goals

- Play local **audio** files with standard controls.
- Index audio from explicitly chosen folders only. No full-disk scanning.
- Persist the library so rescans are incremental and fast.
- **Playlists:** create, rename, delete, add/remove tracks, drag to reorder.
- **Per-file resume:** every file remembers its last playback position.
- **Per-playlist resume:** every playlist remembers which entry was last playing.
- **Voice Boost:** one toggle, tuned for speech, with no multi-band EQ.
- **Playback speed:** a simple dropdown, 0.75× to 2.0×.
- **Keyboard:** Space for play/pause, arrow keys for ±10-second seek.
- **Media keys:** play/pause/next/prev from the OS.
- Dark theme only.
- Stay responsive with libraries in the tens of thousands of tracks.
- Ship as a runnable app the author uses locally. No packaging or distribution for v1.

### Non-goals (v1 and beyond)

**Permanently out of scope:**

- Search and filtering.
- Cover art.
- Statistics and listening history.
- Import/export (M3U or otherwise).
- Streaming, cloud, or network features.
- Crossfade, ReplayGain, or multi-band EQ.

**Out of scope for v1, but a possible future:**

- Video playback.
- Folder watching (automatic rescans on file system changes).
- Virtual scrolling for very large libraries.
- Packaging and distribution.

**Out of scope for v1, lower priority than Voice Boost:**

- System tray icon.
- Mini player.
- Additional Voice Boost presets.

---

## 3. Technology stack

| Layer | Choice | Rationale |
|---|---|---|
| Shell | Electron | Cross-platform Chromium runtime with a Node.js main process |
| Language | **TypeScript** | Compile-time safety across the IPC boundary and the store |
| Build tool | electron-vite | Bundles main, preload, and renderer; dev server with HMR |
| Renderer | React 18 | Function components and hooks only |
| State | Zustand | Tiny, works outside React, selector-based subscriptions |
| Styling | Plain CSS | No CSS-in-JS |
| Media element | `<video>` | Owned by a controller singleton; hidden for audio-only files |
| Playback | HTMLMediaElement | Routed through Web Audio |
| Audio processing | Web Audio API | BiquadFilter + DynamicsCompressor for Voice Boost |
| Metadata | music-metadata | Read tags for display; not a query dimension |
| Database | sql.js (WASM) | No native compilation, no electron-rebuild |
| File walking | Node fs.promises | No dependency |

### 3.1 Why `<video>` in an audio-only app

The renderer's media element is a `<video>`, hidden via CSS for audio-only files. Three reasons:

1. **`createMediaElementSource` is a one-shot binding.** Once called on an element, that element's audio is permanently routed through Web Audio. Swapping `<audio>` for `<video>` later would orphan the old source node and force a graph rework. Using `<video>` now means the graph is bound to an element that never needs to change.
2. **One playback code path.** Audio and video playback share every code path.
3. **The cost is a hidden element.** `<video>` plays audio-only files perfectly.

This decision makes a future video feature additive rather than structural, at essentially zero cost today.

---

## 4. Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node.js + TypeScript)                         │
│                                                             │
│  • BrowserWindow                                            │
│  • sql.js database + debounced persistence                  │
│  • Filesystem walking + metadata parsing                    │
│  • IPC handlers                                             │
│                                                             │
└───────────────────────────┬─────────────────────────────────┘
                            │ IPC (contextBridge)
┌───────────────────────────┴─────────────────────────────────┐
│ PRELOAD (TypeScript)                                        │
│  • Narrow, validated API surface exposed as window.api      │
└───────────────────────────┬─────────────────────────────────┘
                            │ window.api.*
┌───────────────────────────┴─────────────────────────────────┐
│ RENDERER (React + TypeScript)                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ CONTROLLER LAYER (module singletons, outside React)   │  │
│  │  • mediaController — owns the <video> element         │  │
│  │  • audioGraph      — owns the Web Audio graph         │  │
│  │  • resumeTracker   — throttles position saves         │  │
│  │  • scanListener    — subscribes to main scan events   │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ▲                                  │
│                          │ reads/writes                     │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ZUSTAND STORE                                         │  │
│  │  librarySlice · playlistsSlice · playerSlice          │  │
│  │  foldersSlice · settingsSlice · scanSlice             │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ▲                                  │
│                          │ subscribes                       │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ REACT COMPONENTS                                      │  │
│  │  <MediaSurface> <PlayerBar> <LibraryView>             │  │
│  │  <PlaylistsView> <PlaylistView> <FoldersView>         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### The four-layer split

1. **Main process** owns all I/O: the database, the file system, metadata parsing.
2. **Preload** exposes a small, typed API surface via `contextBridge`.
3. **Controller layer** owns the imperative singletons — the media element, the Web Audio graph, the resume throttle, the scan event subscription. These are module-level objects, not React state, and not React refs. They exist for the app's lifetime.
4. **React** owns the pixels, driven by the Zustand store.

**The central architectural rule:** the media element and the Web Audio graph are owned by module-level controllers, not by React. React never creates, re-creates, or conditionally renders the media element. It mounts a container; the controller attaches its element to it.

---

## 5. Project structure

```text
audio-player/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── .editorconfig
├── .gitattributes
├── src/
│   ├── shared/                     # types used by main, preload, and renderer
│   │   └── api.ts                  # AppApi, Track, Playlist, PlayContext, ...
│   │
│   ├── main/                       # main process (Node)
│   │   ├── index.ts                # app lifecycle, IPC registration
│   │   ├── db.ts                   # sql.js setup + persistence + queries
│   │   ├── scanner.ts              # folder walking + metadata parsing
│   │   ├── playlists.ts            # playlist CRUD
│   │   └── ipc.ts                  # IPC handler registration
│   │
│   ├── preload/
│   │   ├── index.ts                # contextBridge API
│   │   └── index.d.ts              # global Window type augmentation
│   │
│   └── renderer/                   # React app (browser)
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx            # React root
│       │   ├── App.tsx
│       │   │
│       │   ├── controllers/
│       │   │   ├── mediaController.ts
│       │   │   ├── audioGraph.ts
│       │   │   ├── voiceBoost.ts
│       │   │   ├── resumeTracker.ts
│       │   │   └── scanListener.ts
│       │   │
│       │   ├── store/
│       │   │   ├── index.ts
│       │   │   ├── librarySlice.ts
│       │   │   ├── playlistsSlice.ts
│       │   │   ├── playerSlice.ts
│       │   │   ├── foldersSlice.ts
│       │   │   ├── settingsSlice.ts
│       │   │   └── scanSlice.ts
│       │   │
│       │   ├── hooks/
│       │   │   ├── useLibrary.ts
│       │   │   ├── usePlaylists.ts
│       │   │   ├── usePlayer.ts
│       │   │   └── useScanProgress.ts
│       │   │
│       │   ├── components/
│       │   │   ├── MediaSurface.tsx
│       │   │   ├── PlayerBar.tsx
│       │   │   ├── SeekBar.tsx
│       │   │   ├── TransportControls.tsx
│       │   │   ├── VoiceBoostToggle.tsx
│       │   │   ├── SpeedDropdown.tsx
│       │   │   ├── LibraryView.tsx
│       │   │   ├── TrackRow.tsx
│       │   │   ├── PlaylistsView.tsx
│       │   │   ├── PlaylistView.tsx
│       │   │   ├── PlaylistEntryRow.tsx
│       │   │   ├── FoldersView.tsx
│       │   │   └── ScanProgress.tsx
│       │   │
│       │   └── styles/
│       │       ├── global.css
│       │       └── *.module.css
│       │
│       └── (build outputs go to out/)
│
└── resources/
    └── icon.png
```

### TypeScript across the boundary

`src/shared/api.ts` is the single source of truth for the shape of every cross-process call. Both the Node-side tsconfig and the web-side tsconfig include `src/shared/**/*`, so the same interface compiles under both environments. The preload script asserts that its exposed object satisfies `AppApi`; the renderer gets `window.api` typed via a global declaration in `src/preload/index.d.ts`.

The result: if you add a method to the main process without updating the preload, the preload fails to compile. If you add it to the preload without updating the shared interface, the preload fails to compile. If you call it from the renderer with the wrong arguments, the renderer fails to compile. Every change propagates through the compiler.

---

## 6. Data model

SQLite database at `app.getPath('userData')/library.db`.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS folders (
  id   INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id                INTEGER PRIMARY KEY,
  path              TEXT UNIQUE NOT NULL,
  folder_id         INTEGER NOT NULL,
  media_type        TEXT    NOT NULL DEFAULT 'audio',   -- 'audio' | 'video'
  title             TEXT,
  artist            TEXT,
  album             TEXT,
  duration          REAL,
  mtime             INTEGER,
  position          REAL    NOT NULL DEFAULT 0,   -- resume point, seconds
  position_updated  INTEGER,                       -- epoch ms, last save
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlists (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  current_entry_id INTEGER,
  created_at       INTEGER,
  updated_at       INTEGER,
  FOREIGN KEY (current_entry_id) REFERENCES playlist_tracks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id           INTEGER PRIMARY KEY,
  playlist_id  INTEGER NOT NULL,
  track_id     INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL,
  added_at     INTEGER,
  UNIQUE (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracks_folder      ON tracks(folder_id);
CREATE INDEX IF NOT EXISTS idx_tracks_media_type  ON tracks(media_type);
CREATE INDEX IF NOT EXISTS idx_pt_playlist        ON playlist_tracks(playlist_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pt_track           ON playlist_tracks(track_id);
```

### Schema notes

**`tracks.position`** is the resume point for that file, in seconds. It is global — the same file resumes at the same point regardless of how you reach it.

**`playlists.current_entry_id`** references a specific `playlist_tracks` row, not a `track_id`. The FK's `ON DELETE SET NULL` means that removing the current entry clears the cursor without destroying the playlist.

**`UNIQUE (playlist_id, track_id)`** enforces the "no duplicates in a playlist" rule at the database level. Adding a track that's already in the playlist is a no-op.

**`settings`** holds scalar state: `library.current_track_id`, `library.last_view`, `voiceBoost`, `playbackSpeed`.

**`media_type`** is populated from the file extension at scan time. The UI filters to `media_type = 'audio'` in v1. Indexing video files now costs nothing and makes a future video feature a query change, not a rescan.

### The critical rule: never clobber resume state on rescan

The scanner's upsert updates tag fields but **must not touch `position` or `position_updated`**:

```sql
INSERT INTO tracks (path, folder_id, media_type, title, artist, album, duration, mtime)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(path) DO UPDATE SET
  folder_id  = excluded.folder_id,
  media_type = excluded.media_type,
  title      = excluded.title,
  artist     = excluded.artist,
  album      = excluded.album,
  duration   = excluded.duration,
  mtime      = excluded.mtime;
  -- position and position_updated deliberately NOT in the SET list
```

This is the single most important detail in the schema. If the upsert wrote `position`, every rescan would wipe the user's resume points.

---

## 7. IPC API surface

Defined in `src/shared/api.ts` as the `AppApi` interface.

| Namespace | Method | Purpose |
|---|---|---|
| `folders` | `list()` | All library folders |
| `folders` | `add()` | Folder picker, insert chosen |
| `folders` | `remove(id)` | Delete folder and its tracks |
| `library` | `scan()` | Rescan all folders |
| `tracks` | `list()` | All audio tracks |
| `tracks` | `inFolder(id)` | Tracks in one folder |
| `tracks` | `getPosition(id)` | Read resume point |
| `tracks` | `savePosition(id, seconds)` | Write resume point |
| `playlists` | `list()` | All playlists with track counts |
| `playlists` | `create(name)` | New empty playlist |
| `playlists` | `rename(id, name)` | Rename |
| `playlists` | `remove(id)` | Delete playlist |
| `playlists` | `get(id)` | Playlist with ordered entries |
| `playlists` | `addTracks(id, trackIds)` | Append tracks (no duplicates) |
| `playlists` | `removeEntry(entryId)` | Remove one entry |
| `playlists` | `reorder(id, entryIds)` | Rewrite sort order |
| `playlists` | `setCurrent(id, entryId)` | Persist playlist cursor |
| `playlists` | `getCurrent(id)` | Read cursor |
| `settings` | `get(key)` / `set(key, value)` | Scalar state |
| `on` | `scanStart` / `scanProgress` / `scanDone` / `scanFinished` | Scan events |

Every handler validates its inputs at runtime. A `null` id, a non-number id, or a missing key is rejected before it reaches the database. TypeScript annotations are a compile-time claim; they do not protect against a buggy or malicious renderer.

---

## 8. Folder management

Folders are persistent. The user adds them once; the app remembers them.

**Add:** native directory picker with `multiSelections: true`. Each selected path is inserted with `INSERT OR IGNORE`. Before insertion, the path is checked against existing folders: if it is an ancestor or descendant of one already in the library, the add is rejected with a message. Overlapping roots would cause the same file to be assigned to whichever folder scanned last, which is confusing and breaks resume semantics.

**Remove:** deletes the folder row. `ON DELETE CASCADE` removes its tracks, and a further cascade removes those tracks from playlists. If a playlist's `current_entry_id` pointed at one of the deleted entries, `ON DELETE SET NULL` clears the cursor.

**List:** shown in the sidebar with a Remove button per entry.

Rescanning only touches folders in the `folders` table. There is no "scan this folder once" path — every scan is library-driven.

---

## 9. Scanning engine

The scanner walks each folder, extracts tags, and reconciles the results with the database.

### Algorithm

For each folder:

1. Load existing `(path, mtime)` for that folder into a map.
2. Recursively walk the folder, skipping hidden entries (names starting with `.`).
3. For each media file:
   - `stat` it to get `mtime`.
   - If `mtime` matches the DB, skip.
   - Otherwise, classify by extension, parse metadata, and stage for upsert.
   - Record the path in a `seen` set.
4. Batch-insert staged rows in transactions of 100.
5. After the walk, delete any DB row for this folder whose path is not in `seen`.
6. `flush()` the database to disk.
7. Emit progress events periodically.

### Extension sets

```ts
const AUDIO_RE = /\.(mp3|flac|m4a|aac|ogg|opus|wav|wma|aiff)$/i;
const VIDEO_RE = /\.(mp4|m4v|webm|mkv)$/i;
const MEDIA_RE = new RegExp(`(?:${AUDIO_RE.source})|(?:${VIDEO_RE.source})`, 'i');
```

Video extensions are indexed but hidden from the UI in v1. When video support lands, no rescan will be required.

### Incremental rescans

The `mtime` comparison means a rescan of an unchanged library does almost no work — directory walks and `stat` calls only. Only new or modified files are re-parsed. This is what makes a large library practical.

### Deletion handling

The `seen` set handles files that vanished between scans. Combined with cascade deletes for folder removal, the database stays in sync without manual maintenance.

### Progress reporting

The scanner emits `scan:start`, `scan:progress`, and `scan:done` per folder, plus a final `scan:finished`. The renderer displays a progress bar with the current folder's path and a processed-file count. Progress events are throttled to one per 50 files to avoid flooding IPC.

### Concurrency

Metadata parsing is I/O-bound. For very large libraries, wrap `parseFile` in a concurrency limiter (~8–16 parallel) to avoid exhausting file descriptors. Sequential parsing is fine for a few thousand files.

---

## 10. Playback

### 10.1 The media controller owns the element

The `<video>` element is created imperatively by `mediaController.ts`, kept in a module-level variable, and mounted into a React-rendered container via a ref. React never owns the element and never re-creates it.

The `<MediaSurface>` component renders a `<div>` container. In a `useEffect`, it calls `attachToContainer(containerRef.current)`, which appends the singleton element to the container. The effect's cleanup function is intentionally empty: React re-mounts effects (in StrictMode, on HMR, on re-renders), and if the cleanup detached the element, playback would be disrupted.

### 10.2 The Web Audio graph

The graph is built once, at the first user gesture, and never rebuilt. Its structure is fixed:

```text
source (bound to <video> forever)
  ├─ bypass path     → destination
  └─ voiceBoostChain → destination
```

Exactly one path is connected at any time. Switching means disconnecting one and connecting the other — the source node itself is never recreated.

**Why this structure:** the two classic retrofit traps are both closed. The media element is never swapped, so `createMediaElementSource` is called exactly once. The bypass path is a first-class route, so Voice Boost being off is a bit-perfect pass-through. When video arrives, the rule becomes "force bypass for video tracks" — a one-line branch in the caller.

### 10.3 AudioContext lifecycle

The context is created on the first `play()` call — which is also the first user gesture, satisfying Chromium's autoplay policy. `resumeContextIfNeeded()` is called before every `play()` in case the OS suspended the context.

### 10.4 Advancing

On `ended`, the controller reads `currentContext` from the store and plays the next track in that context. If the ended track is the last in the current context, playback stops.

The `currentContext` object is captured when playback starts and carried through auto-advance:

- `{ kind: 'library' }` — advancing follows the library order.
- `{ kind: 'playlist', playlistId, entryId }` — advancing follows the playlist's entry order.

This is what makes auto-advance stay within the context the user launched from.

### 10.5 Playback speed

A single app-wide value, persisted in `settings['playbackSpeed']`. Options are 0.75×, 1.0×, 1.25×, 1.5×, 1.75×, 2.0×. Set via `player.playbackRate`. Chromium preserves pitch by default (`preservesPitch`), so speech remains intelligible at higher speeds.

The value persists across tracks and across sessions. It is not stored per-track.

---

## 11. Resume system

The headline feature. There are two independent pieces of state:

1. **Per-file position** — `tracks.position`, in seconds.
2. **Per-context cursor** — `playlists.current_entry_id` for playlists, and `settings['library.current_track_id']` for the flat library.

### 11.1 Per-file resume

**Writing the position** is throttled and event-driven:

- `timeupdate` fires ~4 times per second. The resume tracker saves at most once every 5 seconds.
- `pause`, `seeked`, and `ended` all trigger an immediate save.
- `beforeunload` in the renderer triggers a final save.
- `app.on('before-quit')` in main flushes the database synchronously.

**Reading the position** happens after the media element has loaded metadata, because `currentTime` cannot be set before the browser knows the duration. The saved position is applied in the `loadedmetadata` handler.

If a track's saved position is at or near the end (within 1 second of duration), it is **still resumed at that position** — the app does not auto-reset near-end positions. The only thing that resets a position to zero is the `ended` event, which fires when the track plays all the way through.

### 11.2 Per-playlist resume

Each playlist stores the `playlist_tracks.id` of the entry that was last playing. When a track starts playing from a playlist context, the cursor is written. When the playlist is opened, the cursor is read and the matching entry is highlighted; a "Resume" button at the top plays it.

The flat library behaves as a pseudo-playlist: `settings['library.current_track_id']` holds the last played track's id. On app launch, the library view scrolls to and highlights that track, and a "Continue" button at the top resumes it.

The library's "last view" is also persisted: `settings['library.last_view']` holds either `'library'` or `'playlist:<id>'`. On app launch, the app reopens to whatever view was active when it was closed.

### 11.3 The three rules

1. **Opening a file resumes it from its last saved position.** The only exception is an explicit "Play from start" action.
2. **Opening a playlist restores its cursor.** The entry that was last playing is highlighted; a Resume button plays it.
3. **Auto-advance stays within the context** the user launched from. A track that ends in a playlist advances to the next entry in that playlist, not to the next track in the library.

### 11.4 Edge cases

| Situation | Behaviour |
|---|---|
| Track played to completion (`ended` fires) | Position reset to 0 |
| Track stopped at 99% and app closed | Resumes at 99% on next play |
| Same track in two playlists | Each playlist has its own cursor; the file's position is shared |
| Track removed from disk | Track, playlist entries, and library cursor (if pointed there) all clean up via cascades |
| Playlist's current entry removed manually | Cursor cleared via `ON DELETE SET NULL` |
| App closed mid-playback | `beforeunload` saves position; `db.closeSync()` on `before-quit` flushes |
| Database save fails transiently | Debounced save marks dirty again and retries |

---

## 12. Playlists

### 12.1 Operations

- **Create:** `playlists.create(name)` inserts a row. The playlist appears in the sidebar immediately.
- **Rename:** `playlists.rename(id, name)` updates the name.
- **Delete:** `playlists.remove(id)` deletes the row. `ON DELETE CASCADE` removes all `playlist_tracks` entries.
- **Add tracks:** `playlists.addTracks(id, trackIds)` appends tracks in order. The `UNIQUE (playlist_id, track_id)` constraint means any track already in the playlist is silently skipped. There are no duplicates.
- **Remove entry:** `playlists.removeEntry(entryId)` deletes one `playlist_tracks` row. If that row was the playlist's `current_entry_id`, the cursor is cleared.
- **Reorder:** `playlists.reorder(id, entryIds)` rewrites `sort_order` for the given entries in a single transaction.

### 12.2 Adding tracks to a playlist

Right-click a track in the library view, choose "Add to playlist," and pick from a submenu of existing playlists plus a "New playlist" option. Multi-select is supported: right-click on a selection adds all selected tracks in one operation.

Drag-and-drop onto a sidebar playlist is a possible future enhancement.

### 12.3 Reordering

Entries are reordered by dragging. The UI tracks the new order in local state during the drag and sends the final order to `playlists.reorder` on drop. The database updates `sort_order` values in a single transaction to keep the list contiguous.

### 12.4 Interaction with the library

Deleting a track from the library (via the folder removal flow or a rescan that finds the file gone) cascades to remove it from all playlists. The user sees the playlist shrink; no "missing file" placeholders are shown.

---

## 13. Voice Boost

**Scope:** a single on/off toggle. Not a multi-band EQ. State is app-global and stored in `settings['voiceBoost']`.

**Placement:** a button in the player bar, next to play/pause.

**Processing:** a Web Audio chain tuned for speech intelligibility.

```text
source → highpass(80 Hz) → peaking(2.5 kHz, +4 dB, Q=1.0) → compressor → destination
```

**Why these nodes:**

- **High-pass at 80 Hz** removes plosives, HVAC hum, and desk noise without touching the voice fundamental.
- **+4 dB peak at 2.5 kHz** lifts the consonant band where intelligibility lives. It's the single most effective move for spoken-word audio.
- **Compressor** evens out level differences between speakers, rooms, and mic positions — common in podcasts and meeting recordings.

**Visual feedback:** the toggle button highlights when active.

**Persistence:** the toggle state is read on startup and applied after the Web Audio graph is built on the first play.

**Why not a full EQ:** this app targets speech. A parametric EQ invites endless fiddling and is overkill for podcasts. A single well-tuned preset delivers most of the value with none of the UI complexity.

---

## 14. Renderer and UI

### 14.1 Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Sidebar                 │ Main pane                         │
│                         │                                   │
│  FOLDERS                │  Library view                     │
│   • D:\Audio\Podcasts   │  or                               │
│   • D:\Audio\Lectures   │  Playlist view                    │
│   [+ Add folder]        │                                   │
│                         │                                   │
│  PLAYLISTS              │                                   │
│   • Morning commute     │                                   │
│   • CS lectures         │                                   │
│   [+ New playlist]      │                                   │
│                         │                                   │
├─────────────────────────┴───────────────────────────────────┤
│ Player bar                                                  │
│  [⏮] [▶] [⏭]  0:12:34 ─────●──────── 1:45:20  [1.5×] [VB] │
└─────────────────────────────────────────────────────────────┘
```

Dark theme only. The sidebar and main pane scroll independently; the player bar is fixed to the bottom.

### 14.2 Views

**Library view.** A flat list of audio tracks, ordered by file path. The row matching `library.current_track_id` is highlighted. A "Continue" button at the top resumes it. Each row shows title (or filename if no tag), artist, album, and a subtle resume indicator (elapsed time) if the track has a saved position.

**Playlists view (sidebar).** List of playlists with track counts. Clicking a playlist switches the main pane to the playlist view.

**Playlist view.** Ordered entries. The entry matching `current_entry_id` is highlighted. A "Resume" button at the top plays it. Each entry has a context menu: play from start, remove from playlist.

**Folders view (sidebar).** List of library folders with a Remove button per entry. A "Rescan library" button at the top of the sidebar triggers `library.scan()`.

**Scan progress.** When a scan is running, a bar appears at the top of the main pane showing the current folder path and a processed-file count.

**Player bar.** Play/pause, previous/next, seek bar, current time / duration, speed dropdown, Voice Boost toggle. The speed dropdown is a plain `<select>` styled to match the bar.

### 14.3 State: Zustand

Zustand is used for three reasons:

1. **Event handlers outside React need to write state.** The `timeupdate`, `ended`, and `scan:progress` handlers live in controller modules and cannot call `useState` setters. Zustand's `useStore.getState().action()` works from anywhere.
2. **Context re-renders everything under the provider.** With a media app, the current track changes often; a naive context would re-render the library list unnecessarily. Selector-based subscriptions mean `<TrackRow>` only re-renders when its own track changes.
3. **It is tiny.** ~1 KB, no provider, no boilerplate.

The store is split into slices for organisation, merged into a single store.

### 14.4 The seek bar exception

`timeupdate` fires ~4 times per second. Wiring it through state would cause four re-renders per second across the tree. The seek bar bypasses React's render cycle for the fast-changing value: it reads `mediaController.getElement().currentTime` inside a `requestAnimationFrame` loop and updates its own DOM nodes directly. Only `duration` comes from React state (it changes once per track).

This is the correct pattern for any fast-changing value in a React media app, and it is applied consistently.

### 14.5 Keyboard

Only two shortcuts in v1:

- **Space** — play/pause.
- **Arrow Up/Down** or **Arrow Left/Right** — seek ±10 seconds.

Additional shortcuts are deferred.

### 14.6 Media keys

`navigator.mediaSession` is used to handle OS-level media keys: play, pause, previous track, next track. Metadata (title, artist, album) is set on each track change so the OS overlay shows useful information.

### 14.7 Scaling

Above a few thousand visible rows, virtual scrolling via `@tanstack/react-virtual` would be needed. Deferred for v1.

---

## 15. Security

Follow Electron's recommended posture:

```ts
new BrowserWindow({
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,    // renderer cannot reach Node globals
    nodeIntegration: false,    // no require() in the renderer
    sandbox: false             // needed for a Node-based preload
  }
});
```

- All file system and database access happens in main.
- `contextBridge` exposes only the `AppApi` surface.
- Every IPC handler validates its inputs at runtime.
- React escapes interpolated strings by default. `dangerouslySetInnerHTML` is never used. Any direct DOM manipulation (e.g. in the seek bar) never inserts user-controlled strings.
- A Content Security Policy disallows `unsafe-eval` in production. In dev, Vite's HMR requires `unsafe-eval`, so the CSP is relaxed only for the dev server.

---

## 16. Pitfalls and gotchas

### Resume and data integrity

1. **Clobbering resume state on rescan.** The upsert must not include `position` or `position_updated` in its `DO UPDATE SET` clause. `media_type` **is** included so renames are picked up.
2. **Foreign keys off by default in SQLite.** Run `PRAGMA foreign_keys = ON` immediately after opening.
3. **`ON DELETE SET NULL` on `playlists.current_entry_id`.** Without this FK declaration, removing a playlist entry leaves a dangling cursor.
4. **`beforeunload` is not guaranteed.** Also flush on `app.on('before-quit')` via `db.closeSync()`.

### sql.js

5. **`db.export()` rewrites the whole file.** Debounce saves; `flush()` after bulk operations like folder scans and playlist reorders.
6. **WASM loading.** Read the `.wasm` file yourself and pass it as `wasmBinary`. `require.resolve('sql.js')` finds the package; `path.dirname` and `path.join` find the sibling `.wasm`. Slice the underlying `ArrayBuffer` rather than passing the `Buffer` directly.

### Media element and Web Audio

7. **`createMediaElementSource` is one-shot.** Bound to the `<video>` element once at the first user gesture; never recreated.
8. **Don't use `display: none` on the media element.** Use the off-screen 1-pixel technique. Some browsers pause hidden media.
9. **AudioContext starts suspended.** Call `resumeContextIfNeeded()` before every `play()`.
10. **`currentTime` set before `loadedmetadata` is ignored.** Always wait for the event.
11. **Never render the `<video>` element conditionally.** If React unmounts it, the Web Audio binding is destroyed and playback stops. It is created imperatively and mounted into a persistent container.
12. **Never call `detach()` in a `useEffect` cleanup.** React re-runs effects. The correct cleanup is a no-op.

### React

13. **React StrictMode double-invokes effects in development.** Any effect that calls `createMediaElementSource`, subscribes to `window.api.on.*`, or initialises the resume tracker will run twice. All controller initialisers must be idempotent with module-level guards.
14. **Vite HMR can invalidate controller singletons.** Editing a controller module during dev orphans the old element and its Web Audio graph. Work on controller modules requires a manual refresh. Production has no HMR.
15. **`timeupdate` must not write to the Zustand store.** It fires 4×/sec. Use the imperative `rAF` pattern for the seek bar.
16. **Selector granularity matters.** Always select the smallest slice: `useStore(s => s.currentTrack?.id)`. Avoid anonymous selectors that return new objects.
17. **Async actions in the store must handle races.** Rapid track switching can leave two `play()` calls in flight; use a token or accept the element's last-`src`-wins semantics.

### Environment

18. **`music-metadata` is ESM.** Use `await import('music-metadata')` inside the scan function.
19. **File URLs built in main** with `pathToFileURL()`. Never concatenate `'file://'`.
20. **`file.path` was removed from drag-and-drop in Electron 32+.** Use `webUtils.getPathForFile(file)`.
21. **Overlapping library folders.** Rejected at add time.
22. **Unreadable directories.** Wrap `fs.readdir` in try/catch and skip.
23. **Line endings on Windows.** `.editorconfig` and `.gitattributes` both enforce LF. Prettier is configured to `lf`.

---

## 17. Roadmap

Estimated total time to a usable v1: **8–12 weeks** at 5–10 hours per week.

### Milestone 1 — Playback skeleton (weeks 1–2)

- electron-vite TypeScript project structure.
- React root, Zustand store with empty slices.
- `mediaController.ts` creating the `<video>` element, `audioGraph.ts` with the routing switch, `<MediaSurface>` component attaching the element.
- Play a hardcoded audio file with play/pause/seek.
- Speed dropdown wired end to end (`playbackRate`).
- Voice Boost toggle wired end to end.

### Milestone 2 — Library core (weeks 3–5)

- sql.js setup, schema, debounced persistence, generic typed query helpers.
- Folder add/list/remove with overlap rejection.
- Scanner with `mtime` check, `media_type` classification, deletion reconciliation.
- IPC bridge for folders, tracks, and scan events.
- `<LibraryView>` with `<TrackRow>` and the Continue button.
- **Per-file resume:** resume tracker, `getPosition`/`savePosition`, imperative seek bar.

### Milestone 3 — Playlists and playlist resume (weeks 5–7)

- Playlist CRUD.
- Playlist sidebar, playlist view, context menus.
- Add tracks via right-click; drag to reorder.
- **Per-playlist resume:** cursor write on play, highlight on open, Resume button.
- **Library cursor** and **last-view persistence.**

### Milestone 4 — Polish (weeks 7–9)

- Scan progress bar.
- Keyboard shortcuts: Space, arrows.
- Media keys via `navigator.mediaSession`.
- Player bar visual polish, dark theme pass.
- Context menu styling and behaviour.

### Milestone 5 — Comfort and scale (weeks 9–12)

- Virtual scrolling with `@tanstack/react-virtual`.
- Error states and loading states throughout.
- Settings view (theme is fixed for now, but a settings pane for scan-on-launch and default view).
- Manual testing pass across a realistic library (thousands of files).

---

## 18. Deferred and out of scope

### Possible future features

- **Video playback.** The `<video>` element is already the media surface. The schema already has `media_type`. Adding video requires: enabling video rows in the library query, showing the media element when the current track is video, and adding fullscreen/picture-in-picture controls. No schema migration, no structural changes to the controller or the store.
- **Folder watching** with `chokidar` for automatic rescans on file changes.
- **Drag-and-drop** adding tracks to playlists in the sidebar.

### Permanently out of scope

- Search and filtering.
- Cover art.
- Statistics and play counts.
- Import/export of playlists.
- Multi-band equaliser.
- Streaming or network features.
- Crossfade, ReplayGain.

---

## 19. Summary

This is a focused, moderate-difficulty solo project. It has three distinguishing features:

1. **sql.js** removes native build friction at the cost of manual persistence. The design handles persistence with debounced writes plus explicit flushes on scan completion and app quit.
2. **The media element and Web Audio graph live outside React**, owned by module-level controllers. React renders the UI and mounts a container; the controller attaches its element to it. This keeps the one-shot `createMediaElementSource` binding valid for the app's lifetime and sidesteps React's StrictMode and HMR quirks.
3. **Resume state is durable user data, not a cache.** The schema separates it from scan-controlled fields, the upsert is written to preserve it, and the three rules in §11.3 are the contract the app makes to the user.

Everything else — playlists, Voice Boost, speed control, the dark theme — exists to make long-form audio listening pleasant on top of that contract.

The app is deliberately minimal. It has no search, no metadata browsing, no cover art, no cloud. It remembers where you left off, and it plays your files. That's the whole job.