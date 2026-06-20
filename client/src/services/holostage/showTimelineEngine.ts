// ─── Show Timeline Engine ─────────────────────────────────────────────────────
// Manages playback state for the show: songs, cues, position.

import type { HoloShow, ShowSong } from '../../schemas/holostage/showPackage.schema';
import type { TimelineCue } from '../../schemas/holostage/timelineCue.schema';

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'blackout' | 'fallback';

export interface TimelineState {
  playbackState: PlaybackState;
  currentSongIndex: number;
  currentSongId: string | null;
  position: number;          // seconds in current song
  globalPosition: number;    // seconds from show start
  activeCues: TimelineCue[];
  nextCue: TimelineCue | null;
  firedCueIds: Set<string>;
}

type StateChangeCallback = (state: TimelineState) => void;
type CueFiredCallback = (cue: TimelineCue) => void;

class ShowTimelineEngine {
  private show: HoloShow | null = null;
  private state: TimelineState = this.defaultState();
  private onStateChange: StateChangeCallback[] = [];
  private onCueFired: CueFiredCallback[] = [];
  private rafId: number | null = null;
  private startTime: number = 0;
  private pauseOffset: number = 0;

  private defaultState(): TimelineState {
    return {
      playbackState: 'stopped',
      currentSongIndex: 0,
      currentSongId: null,
      position: 0,
      globalPosition: 0,
      activeCues: [],
      nextCue: null,
      firedCueIds: new Set(),
    };
  }

  // ─── Show Loading ─────────────────────────────────────────────────────────

  loadShow(show: HoloShow): void {
    this.show = show;
    this.state = this.defaultState();
    if (show.songs.length > 0) {
      this.state.currentSongId = show.songs[0].id;
    }
    this.emit();
  }

  /** Update cues without resetting playback state. Safe to call on every cue edit. */
  updateCues(cues: TimelineCue[]): void {
    if (!this.show) return;
    this.show = { ...this.show, cues };
    // Re-compute nextCue from updated cue list
    const songCues = this.getCurrentSongCues();
    const upcomingCues = songCues
      .filter(c => c.enabled && !this.state.firedCueIds.has(c.id))
      .sort((a, b) => a.timestamp - b.timestamp);
    this.state.nextCue = upcomingCues[0] ?? null;
    // Populate activeCues: cues that have fired for the current song
    this.state.activeCues = songCues.filter(c => this.state.firedCueIds.has(c.id));
    this.emit();
  }

  // ─── Transport Controls ───────────────────────────────────────────────────

  play(): void {
    if (!this.show || this.show.songs.length === 0) return;
    if (this.state.playbackState === 'playing') return;
    this.startTime = performance.now() - this.pauseOffset * 1000;
    this.state.playbackState = 'playing';
    this.tick();
    this.emit();
  }

  pause(): void {
    if (this.state.playbackState !== 'playing') return;
    this.pauseOffset = this.state.position;
    this.state.playbackState = 'paused';
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.emit();
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.pauseOffset = 0;
    this.state = {
      ...this.defaultState(),
      currentSongId: this.show?.songs[0]?.id ?? null,
    };
    this.emit();
  }

  nextSong(): void {
    if (!this.show) return;
    const next = this.state.currentSongIndex + 1;
    if (next >= this.show.songs.length) return;
    this.jumpToSong(next);
  }

  previousSong(): void {
    if (this.state.currentSongIndex === 0) return;
    this.jumpToSong(this.state.currentSongIndex - 1);
  }

  jumpToSong(index: number): void {
    if (!this.show) return;
    const song = this.show.songs[index];
    if (!song) return;
    this.pauseOffset = 0;
    if (this.state.playbackState === 'playing') {
      this.startTime = performance.now();
    }
    this.state.currentSongIndex = index;
    this.state.currentSongId = song.id;
    this.state.position = 0;
    this.state.firedCueIds = new Set();
    this.emit();
  }

  blackout(): void {
    const prev = this.state.playbackState;
    if (prev === 'blackout') {
      this.state.playbackState = 'paused';
    } else {
      this.state.playbackState = 'blackout';
    }
    this.emit();
  }

  fallback(): void {
    this.state.playbackState = 'fallback';
    this.emit();
  }

  seekTo(seconds: number): void {
    this.pauseOffset = seconds;
    if (this.state.playbackState === 'playing') {
      this.startTime = performance.now() - seconds * 1000;
    }
    this.state.position = seconds;
    // Re-evaluate which cues should have fired
    const cues = this.getCurrentSongCues();
    this.state.firedCueIds = new Set(
      cues.filter(c => c.timestamp <= seconds).map(c => c.id)
    );
    this.emit();
  }

  // ─── Internal Tick ────────────────────────────────────────────────────────

  private tick(): void {
    if (this.state.playbackState !== 'playing') return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    const currentSong = this.getCurrentSong();

    if (!currentSong) {
      this.stop();
      return;
    }

    this.state.position = elapsed;

    // Fire cues
    const cues = this.getCurrentSongCues();
    for (const cue of cues) {
      if (cue.enabled && !this.state.firedCueIds.has(cue.id) && elapsed >= cue.timestamp) {
        this.state.firedCueIds.add(cue.id);
        this.onCueFired.forEach(cb => cb(cue));
      }
    }

    // Populate activeCues: all cues that have fired for this song
    this.state.activeCues = cues.filter(c => this.state.firedCueIds.has(c.id));

    // Next cue
    const upcomingCues = cues
      .filter(c => c.enabled && !this.state.firedCueIds.has(c.id))
      .sort((a, b) => a.timestamp - b.timestamp);
    this.state.nextCue = upcomingCues[0] ?? null;

    // Auto-advance song
    if (elapsed >= currentSong.duration) {
      if (this.state.currentSongIndex + 1 < (this.show?.songs.length ?? 0)) {
        this.nextSong();
        return;
      } else {
        this.stop();
        return;
      }
    }

    this.emit();
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getCurrentSong(): ShowSong | null {
    if (!this.show) return null;
    return this.show.songs[this.state.currentSongIndex] ?? null;
  }

  getCurrentSongCues(): TimelineCue[] {
    if (!this.show || !this.state.currentSongId) return [];
    return this.show.cues.filter(c => c.songId === this.state.currentSongId);
  }

  getState(): TimelineState { return { ...this.state }; }

  // ─── Events ───────────────────────────────────────────────────────────────

  onStateChanged(cb: StateChangeCallback): () => void {
    this.onStateChange.push(cb);
    return () => { this.onStateChange = this.onStateChange.filter(c => c !== cb); };
  }

  onCueFiredEvent(cb: CueFiredCallback): () => void {
    this.onCueFired.push(cb);
    return () => { this.onCueFired = this.onCueFired.filter(c => c !== cb); };
  }

  private emit(): void {
    this.onStateChange.forEach(cb => cb({ ...this.state }));
  }
}

export const showTimelineEngine = new ShowTimelineEngine();
