// Types shared by main, preload, and renderer. Nothing in this file has a
// runtime presence — it's all `interface`, `type`, and `export` of those.

// ---------- Domain types ----------

export type MediaType = 'audio' | 'video';

export interface Track {
  id: number;
  path: string;               // absolute path on disk (for display / debugging)
  folder_id: number;
  media_type: MediaType;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;    // seconds
  position: number;           // saved resume point, seconds
  url: string;                // media://file/<encoded> URL for the renderer
}

export interface Folder {
  id: number;
  path: string;
}

export interface Playlist {
  id: number;
  name: string;
  current_entry_id: number | null;
  trackCount: number;
}

export interface PlaylistEntry {
  id: number;                 // playlist_tracks.id (distinct from track.id)
  playlist_id: number;
  track_id: number;
  sort_order: number;
  track: Track;               // the joined track data
}

export interface PlaylistWithEntries {
  playlist: Playlist;
  entries: PlaylistEntry[];
}

// ---------- Playback context ----------

// Captured at play time. Determines what "next" means when a track ends.
export type PlayContext =
  | { kind: 'library' }
  | { kind: 'playlist'; playlistId: number; entryId: number };

// ---------- Scan events ----------

export interface ScanStartEvent {
  folderId: number;
  path: string;
}

export interface ScanProgressEvent {
  folderId: number;
  processed: number;
}

export interface ScanResult {
  folderId: number;
  processed: number;
  deleted: number;
}

// ---------- The API surface ----------

// Every method is called from the renderer and executed in the main process.
// Return values cross back through IPC as structured-cloned copies.
export interface AppApi {
  folders: {
    list: () => Promise<Folder[]>;
    add: () => Promise<Folder[]>;                // opens native picker
    remove: (id: number) => Promise<Folder[]>;
  };
  library: {
    scan: () => Promise<ScanResult[]>;
  };
  tracks: {
    list: () => Promise<Track[]>;
    inFolder: (folderId: number) => Promise<Track[]>;
    getPosition: (id: number) => Promise<number>;
    savePosition: (id: number, seconds: number) => Promise<void>;
  };
  playlists: {
    list: () => Promise<Playlist[]>;
    create: (name: string) => Promise<Playlist>;
    rename: (id: number, name: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
    get: (id: number) => Promise<PlaylistWithEntries | null>;
    addTracks: (playlistId: number, trackIds: number[]) => Promise<void>;
    removeEntry: (entryId: number) => Promise<void>;
    reorder: (playlistId: number, entryIds: number[]) => Promise<void>;
    setCurrent: (playlistId: number, entryId: number | null) => Promise<void>;
    getCurrent: (playlistId: number) => Promise<number | null>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };
  on: {
    scanStart: (cb: (data: ScanStartEvent) => void) => void;
    scanProgress: (cb: (data: ScanProgressEvent) => void) => void;
    scanDone: (cb: (data: ScanResult) => void) => void;
    scanFinished: (cb: (results: ScanResult[]) => void) => void;
  };
  files: {
    saveJson: (defaultName: string, content: string) => Promise<boolean>;
  };
}