/**
 * One reel, on expo-video.
 *
 * The Explore tab was built on expo-av, which Expo deprecated in SDK 54 and
 * removes in SDK 55. Moving to expo-video changed where every number comes
 * from: time now arrives as timeUpdate events in seconds, playing as
 * playingChange, loading and failure as statusChange. These drive a stand-in
 * player through those events and pin what the old player gave: the active
 * reel plays and the others pause, only time spent playing is counted as
 * watched, the view is handed up once when she scrolls on, and a reel that
 * cannot be played says so instead of spinning for ever.
 *
 * The native player cannot run under Jest, so expo-video and expo's event
 * hooks are replaced by the smallest things that behave like them.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

type Listener = (payload: unknown) => void;

class MockPlayer {
  playing = false;
  status: 'idle' | 'loading' | 'readyToPlay' | 'error' = 'readyToPlay';
  duration = 10;
  loop = false;
  timeUpdateEventInterval = 0;
  private listeners = new Map<string, Set<Listener>>();
  play = jest.fn(() => {
    this.playing = true;
    this.emit('playingChange', { isPlaying: true });
  });
  pause = jest.fn(() => {
    this.playing = false;
    this.emit('playingChange', { isPlaying: false });
  });
  on(name: string, listener: Listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
    return () => this.listeners.get(name)?.delete(listener);
  }
  emit(name: string, payload: unknown) {
    this.listeners.get(name)?.forEach((l) => l(payload));
  }
}

let mockPlayer: MockPlayer;

jest.mock('expo-video', () => {
  const { useRef, createElement } = require('react');
  return {
    useVideoPlayer: (_source: unknown, setup?: (p: MockPlayer) => void) => {
      const ref = useRef(null);
      if (!ref.current) {
        ref.current = mockPlayer;
        setup?.(mockPlayer);
      }
      return ref.current;
    },
    VideoView: (props: Record<string, unknown>) => createElement('VideoView', props),
  };
});

jest.mock('expo', () => {
  const { useEffect, useRef, useState } = require('react');
  return {
    useEvent: (player: MockPlayer, name: string, initial: unknown) => {
      const [value, setValue] = useState(initial);
      useEffect(() => player.on(name, setValue), [player, name]);
      return value;
    },
    useEventListener: (player: MockPlayer, name: string, listener: Listener) => {
      const latest = useRef(listener);
      latest.current = listener;
      useEffect(() => player.on(name, (payload: unknown) => latest.current(payload)), [player, name]);
    },
  };
});

jest.mock('../../services/api-extensions', () => ({ videoApi: { recordView: jest.fn() } }));
jest.mock('../../services/api', () => ({ unwrapApiData: (p: { data?: unknown }) => p?.data ?? p, webUrl: (p: string) => p }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useNavigation: () => ({ navigate: jest.fn() }) }));

import { VideoItem } from '../VideoFeedScreen';
import { shows } from './renderScreen';

jest.setTimeout(30_000);

const reel = {
  id: 'reel-1',
  authorId: 'a1',
  author: { id: 'a1', displayName: 'Mei', avatar: null },
  videoUrl: 'https://cdn.example/reel-1.mp4',
  thumbnailUrl: null,
  title: 'Morning routine',
  description: null,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  viewCount: 0,
  isLiked: false,
  isSaved: false,
  hashtags: [],
  createdAt: '2026-09-26T00:00:00.000Z',
};

const noop = () => undefined;
let renderer: ReactTestRenderer | null = null;

async function mount(isActive: boolean, onViewEnd = jest.fn()) {
  await act(async () => {
    renderer = TestRenderer.create(<VideoItem video={reel} isActive={isActive} onLike={noop} onSave={noop} onComment={noop} onShare={noop} onViewEnd={onViewEnd} />);
  });
  return onViewEnd;
}

async function setActive(isActive: boolean, onViewEnd: jest.Mock) {
  await act(async () => {
    renderer!.update(<VideoItem video={reel} isActive={isActive} onLike={noop} onSave={noop} onComment={noop} onShare={noop} onViewEnd={onViewEnd} />);
  });
}

beforeEach(() => {
  mockPlayer = new MockPlayer();
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe('VideoItem on expo-video', () => {
  it('loops, reports every half second, and plays only while it is the reel on screen', async () => {
    const onViewEnd = await mount(true);
    expect(mockPlayer.loop).toBe(true);
    expect(mockPlayer.timeUpdateEventInterval).toBe(0.5);
    expect(mockPlayer.play).toHaveBeenCalled();

    await setActive(false, onViewEnd);
    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('counts only time spent playing, and hands the view up once when she scrolls on', async () => {
    const onViewEnd = await mount(true);

    await act(async () => {
      for (const t of [0, 0.5, 1, 1.5]) mockPlayer.emit('timeUpdate', { currentTime: t });
      // Paused: the clock moving on is not watching.
      mockPlayer.playing = false;
      mockPlayer.emit('timeUpdate', { currentTime: 1.5 });
    });
    await setActive(false, onViewEnd);

    expect(onViewEnd).toHaveBeenCalledTimes(1);
    expect(onViewEnd).toHaveBeenCalledWith('reel-1', expect.objectContaining({ watchedMs: 1500, durationMs: 10000 }));
  });

  it('says a reel could not be played instead of spinning for ever', async () => {
    await mount(true);

    await act(async () => {
      mockPlayer.emit('statusChange', { status: 'error' });
    });

    expect(shows(renderer!, 'This reel could not be played.')).toBe(true);
  });
});
