/**
 * How long a reel was actually watched, from the player's own status updates.
 *
 * The explore feed never told the server a reel had been watched: videoApi.
 * recordView existed and nothing called it, so view counts and watch time
 * from the app were always zero and creators' numbers counted only the web.
 * The server wants seconds watched and how far through, not how long the reel
 * sat on screen, so this counts playback: time only moves while the player
 * says it is playing, a loop back to the start keeps counting, and a seek is
 * not watching.
 */

export type WatchState = {
  /** Where the player was at the last update, or null before the first. */
  lastPositionMs: number | null;
  /** Milliseconds of playback counted so far. */
  watchedMs: number;
  /** The reel's length once the player knows it, 0 until then. */
  durationMs: number;
};

export type PlaybackSample = {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis?: number;
};

/**
 * The player reports about every half second. A jump larger than this between
 * two reports is a seek or a stall, not playback, and is not counted.
 */
export const MAX_COUNTED_STEP_MS = 2_000;

/** Views shorter than this are a reel scrolled past, not watched. */
export const MIN_RECORDED_WATCH_SECONDS = 1;

export function startWatch(): WatchState {
  return { lastPositionMs: null, watchedMs: 0, durationMs: 0 };
}

/** The next state after one playback status update. */
export function advanceWatch(state: WatchState, sample: PlaybackSample): WatchState {
  const durationMs = sample.durationMillis && sample.durationMillis > 0 ? sample.durationMillis : state.durationMs;
  let watchedMs = state.watchedMs;

  if (sample.isPlaying && state.lastPositionMs !== null) {
    let step = sample.positionMillis - state.lastPositionMs;
    // A looping reel wraps from its end to its start: what was played is the
    // tail of the last pass plus the head of this one.
    if (step < 0 && durationMs > 0) {
      step = Math.max(0, durationMs - state.lastPositionMs) + sample.positionMillis;
    }
    if (step > 0 && step <= MAX_COUNTED_STEP_MS) watchedMs += step;
  }

  return { lastPositionMs: sample.positionMillis, watchedMs, durationMs };
}

/**
 * What to send for a finished view, or null when there is nothing worth
 * recording: the server takes whole seconds (at least one) and a completion
 * percentage between 0 and 100. A reel longer than it was watched through
 * reports how far it got; one watched round more than once reports 100.
 */
export function viewToRecord(state: WatchState): { watchDuration: number; completionPct: number } | null {
  const seconds = state.watchedMs / 1000;
  if (seconds < MIN_RECORDED_WATCH_SECONDS) return null;
  const completionPct = state.durationMs > 0 ? Math.min(100, (state.watchedMs / state.durationMs) * 100) : 0;
  return {
    watchDuration: Math.max(1, Math.round(seconds)),
    completionPct: Math.round(completionPct * 10) / 10,
  };
}
