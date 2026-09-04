/**
 * Sounds: the audio a reel plays, reusable across reels.
 *
 * A sound is an AudioTrack row. It is either uploaded on its own, or lifted
 * from a reel as that reel's "original sound" (one track per reel, keyed by
 * sourceVideoId). Video.audioTrackId points at the track a reel uses; it is a
 * plain id rather than a Prisma relation so the column stays optional and
 * cheap, and this module is where the two are joined.
 *
 * Trending is counted from published reels in the period, not from useCount
 * alone: useCount is a lifetime number and would keep last year's sound on
 * top for ever.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

export interface SoundSummary {
  id: string;
  title: string;
  artist: string | null;
  audioUrl: string;
  duration: number;
  coverUrl: string | null;
  isOriginal: boolean;
  useCount: number;
  sourceVideoId: string | null;
}

const SOUND_SELECT = {
  id: true,
  title: true,
  artist: true,
  audioUrl: true,
  duration: true,
  coverUrl: true,
  isOriginal: true,
  useCount: true,
  sourceVideoId: true,
} as const;

export type TrendingPeriod = 'day' | 'week' | 'month' | 'all';

function periodStart(period: TrendingPeriod, now = new Date()): Date | null {
  const day = 24 * 60 * 60 * 1000;
  switch (period) {
    case 'day':
      return new Date(now.getTime() - day);
    case 'week':
      return new Date(now.getTime() - 7 * day);
    case 'month':
      return new Date(now.getTime() - 30 * day);
    default:
      return null;
  }
}

/** Adds `sound` to every video that names a track; null when it names none. */
export async function attachSounds<T extends { audioTrackId?: string | null }>(
  videos: T[]
): Promise<Array<T & { sound: SoundSummary | null }>> {
  const ids = Array.from(
    new Set(videos.map((v) => v.audioTrackId).filter((id): id is string => typeof id === 'string' && id.length > 0))
  );
  if (ids.length === 0) {
    return videos.map((video) => ({ ...video, sound: null }));
  }

  const tracks = await prisma.audioTrack.findMany({
    where: { id: { in: ids }, isHidden: false },
    select: SOUND_SELECT,
  });
  const byId = new Map(tracks.map((track) => [track.id, track]));

  return videos.map((video) => ({
    ...video,
    sound: video.audioTrackId ? byId.get(video.audioTrackId) ?? null : null,
  }));
}

export interface TrendingSound extends SoundSummary {
  videoCount: number;
  recentVideos: Array<{ id: string; thumbnailUrl: string | null }>;
}

export async function getTrendingSounds(options: { period?: TrendingPeriod; limit?: number } = {}) {
  const period = options.period ?? 'week';
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const since = periodStart(period);

  const usage = await prisma.video.groupBy({
    by: ['audioTrackId'],
    where: {
      status: 'PUBLISHED',
      isHidden: false,
      audioTrackId: { not: null },
      ...(since ? { publishedAt: { gte: since } } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { audioTrackId: 'desc' } },
    take: limit,
  });

  const counted = new Map<string, number>();
  for (const row of usage) {
    if (row.audioTrackId) counted.set(row.audioTrackId, row._count._all);
  }

  // A quiet period still deserves a list: top up with all-time favourites.
  let tracks = await prisma.audioTrack.findMany({
    where: { id: { in: Array.from(counted.keys()) }, isHidden: false },
    select: SOUND_SELECT,
  });
  if (tracks.length < limit) {
    const extra = await prisma.audioTrack.findMany({
      where: { isHidden: false, id: { notIn: tracks.map((t) => t.id) } },
      select: SOUND_SELECT,
      orderBy: [{ useCount: 'desc' }, { createdAt: 'desc' }],
      take: limit - tracks.length,
    });
    tracks = [...tracks, ...extra];
  }

  const trackIds = tracks.map((t) => t.id);
  const samples = trackIds.length
    ? await prisma.video.findMany({
        where: { audioTrackId: { in: trackIds }, status: 'PUBLISHED', isHidden: false },
        select: { id: true, thumbnailUrl: true, audioTrackId: true },
        orderBy: { publishedAt: 'desc' },
        take: trackIds.length * 3,
      })
    : [];
  const samplesByTrack = new Map<string, Array<{ id: string; thumbnailUrl: string | null }>>();
  for (const sample of samples) {
    if (!sample.audioTrackId) continue;
    const list = samplesByTrack.get(sample.audioTrackId) ?? [];
    if (list.length < 3) list.push({ id: sample.id, thumbnailUrl: sample.thumbnailUrl });
    samplesByTrack.set(sample.audioTrackId, list);
  }

  const result: TrendingSound[] = tracks.map((track) => ({
    ...track,
    videoCount: counted.get(track.id) ?? track.useCount,
    recentVideos: samplesByTrack.get(track.id) ?? [],
  }));
  result.sort((a, b) => b.videoCount - a.videoCount || b.useCount - a.useCount);
  return { period, sounds: result };
}

export async function getSound(id: string) {
  const track = await prisma.audioTrack.findUnique({ where: { id }, select: SOUND_SELECT });
  if (!track || (await prisma.audioTrack.findUnique({ where: { id }, select: { isHidden: true } }))?.isHidden) {
    throw new ApiError(404, 'Sound not found');
  }
  const videoCount = await prisma.video.count({
    where: { audioTrackId: id, status: 'PUBLISHED', isHidden: false },
  });
  return { ...track, videoCount };
}

export async function createSound(input: {
  createdById: string;
  title: string;
  artist?: string | null;
  audioUrl: string;
  duration: number;
  licenseType?: string | null;
  coverUrl?: string | null;
}) {
  return prisma.audioTrack.create({
    data: {
      title: input.title,
      artist: input.artist ?? null,
      audioUrl: input.audioUrl,
      duration: Math.max(1, Math.round(input.duration)),
      licenseType: input.licenseType ?? 'user-upload',
      coverUrl: input.coverUrl ?? null,
      createdById: input.createdById,
      isOriginal: false,
    },
    select: SOUND_SELECT,
  });
}

/**
 * The original sound of a reel: created the first time anyone asks for it,
 * returned every time after. The audio URL is the reel's own file (a browser
 * plays the audio track of a video file in an <audio> element); the pipeline
 * replaces it with an extracted m4a when ffmpeg is available.
 */
export async function soundFromVideo(videoId: string, requesterId?: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      authorId: true,
      status: true,
      isHidden: true,
      videoUrl: true,
      duration: true,
      thumbnailUrl: true,
      audioTrackId: true,
      author: { select: { displayName: true, firstName: true, lastName: true } },
    },
  });
  if (!video || video.isHidden || (video.status !== 'PUBLISHED' && video.authorId !== requesterId)) {
    throw new ApiError(404, 'Video not found');
  }

  // A reel that already plays a sound is not the source of a new one.
  if (video.audioTrackId) {
    const existing = await prisma.audioTrack.findUnique({
      where: { id: video.audioTrackId },
      select: SOUND_SELECT,
    });
    if (existing) return existing;
  }

  const existing = await prisma.audioTrack.findUnique({
    where: { sourceVideoId: video.id },
    select: SOUND_SELECT,
  });
  if (existing) return existing;

  const authorName =
    video.author.displayName?.trim() ||
    [video.author.firstName, video.author.lastName].filter(Boolean).join(' ').trim() ||
    'ATHENA member';

  const track = await prisma.audioTrack.create({
    data: {
      title: `Original sound - ${authorName}`,
      artist: authorName,
      audioUrl: video.videoUrl,
      duration: Math.max(1, video.duration ?? 1),
      isOriginal: true,
      licenseType: 'original',
      coverUrl: video.thumbnailUrl,
      createdById: video.authorId,
      sourceVideoId: video.id,
      useCount: 1,
    },
    select: SOUND_SELECT,
  });

  await prisma.video.update({ where: { id: video.id }, data: { audioTrackId: track.id } });
  return track;
}

/** Called when a reel is published with a chosen sound. */
export async function recordSoundUse(audioTrackId: string): Promise<void> {
  await prisma.audioTrack.updateMany({
    where: { id: audioTrackId },
    data: { useCount: { increment: 1 } },
  });
}

export async function assertSoundExists(audioTrackId: string): Promise<void> {
  const track = await prisma.audioTrack.findUnique({
    where: { id: audioTrackId },
    select: { id: true, isHidden: true },
  });
  if (!track || track.isHidden) {
    throw new ApiError(400, 'That sound does not exist');
  }
}
