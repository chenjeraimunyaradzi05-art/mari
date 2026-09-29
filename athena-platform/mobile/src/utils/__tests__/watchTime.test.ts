import { describe, expect, it } from '@jest/globals';
import { advanceWatch, startWatch, viewToRecord, type PlaybackSample, type WatchState } from '../watchTime';

const run = (samples: PlaybackSample[]): WatchState => samples.reduce(advanceWatch, startWatch());
const playing = (positionMillis: number, durationMillis = 20_000): PlaybackSample => ({
  isPlaying: true,
  positionMillis,
  durationMillis,
});

describe('watch time', () => {
  it('counts playback between status updates', () => {
    const state = run([playing(0), playing(500), playing(1000), playing(1500), playing(2000)]);
    expect(state.watchedMs).toBe(2000);
    expect(viewToRecord(state)).toEqual({ watchDuration: 2, completionPct: 10 });
  });

  it('does not count time spent paused', () => {
    const state = run([playing(0), playing(1000), { isPlaying: false, positionMillis: 1000 }, { isPlaying: false, positionMillis: 1000 }, playing(1500)]);
    expect(state.watchedMs).toBe(1500);
  });

  it('keeps counting across a loop back to the start', () => {
    const state = run([playing(19_000), playing(19_500), playing(300)]);
    // 500 to the end, then 300 into the next pass.
    expect(state.watchedMs).toBe(500 + 500 + 300);
  });

  it('does not count a seek as watching', () => {
    const state = run([playing(0), playing(500), playing(15_000), playing(15_500)]);
    expect(state.watchedMs).toBe(1000);
  });

  it('records nothing for a reel scrolled past in under a second', () => {
    expect(viewToRecord(run([playing(0), playing(400), playing(800)]))).toBeNull();
    expect(viewToRecord(startWatch())).toBeNull();
  });

  it('caps completion at 100 when a reel was watched round more than once', () => {
    let state = startWatch();
    for (let pass = 0; pass < 3; pass += 1) {
      for (let at = 0; at < 4000; at += 500) state = advanceWatch(state, playing(at, 4000));
    }
    expect(viewToRecord(state)?.completionPct).toBe(100);
  });

  it('reports 0% when the player never said how long the reel is', () => {
    const state = run([{ isPlaying: true, positionMillis: 0 }, { isPlaying: true, positionMillis: 1500 }]);
    expect(viewToRecord(state)).toEqual({ watchDuration: 2, completionPct: 0 });
  });
});
