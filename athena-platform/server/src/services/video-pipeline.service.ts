/**
 * The video processing pipeline.
 *
 * A reel is created PROCESSING and becomes PUBLISHED here. For each one:
 *
 *   1. probe      duration, dimensions, codecs, whether there is audio
 *   2. poster     a frame one second in, scaled to 720px wide, unless the
 *                 uploader already supplied a thumbnail
 *   3. rendition  H.264/AAC MP4 with the moov atom up front, capped at 1080
 *                 rows, unless the upload already is one
 *   4. sound      the audio track extracted to m4a and registered as the
 *                 reel's original sound, unless the reel uses a chosen sound
 *   5. publish    status, duration, aspect ratio, URLs, progress 100
 *
 * ffmpeg comes from the ffmpeg-static package, so the pipeline runs on the
 * API host itself; nothing external is required. When the binary is missing
 * for the platform, or a step fails, the reel is still published with the
 * file as uploaded and the reason recorded in processingError: a reel that
 * plays is better than one stuck on "processing" for ever.
 *
 * Work runs one video at a time in this process. When a BullMQ worker is
 * enabled it hands each video to processVideo() the same way, so the two
 * paths share every step.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { localPathForUrl, storeFile } from '../utils/media-storage';
import { emitToUserRoom } from './socket.service';

let ffmpegBinary: string | null | undefined;

export function ffmpegPath(): string | null {
  if (ffmpegBinary !== undefined) return ffmpegBinary;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dependency, resolved at runtime
    const resolved = require('ffmpeg-static') as string | null;
    ffmpegBinary = resolved && fs.existsSync(resolved) ? resolved : null;
  } catch {
    ffmpegBinary = null;
  }
  return ffmpegBinary;
}

export function isFfmpegAvailable(): boolean {
  return ffmpegPath() !== null;
}

export interface Probe {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hasAudio: boolean;
  container: string | null;
}

function runFfmpeg(args: string[], timeoutMs = 10 * 60 * 1000): Promise<{ code: number; stderr: string }> {
  const binary = ffmpegPath();
  if (!binary) return Promise.reject(new Error('ffmpeg is not available on this host'));

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`ffmpeg timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

/** ffmpeg prints what it knows about an input on stderr; that is the probe. */
export function parseProbeOutput(stderr: string, fileName = ''): Probe {
  const durationMatch = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : null;

  const videoMatch = /Stream #\d+:\d+(?:\[[^\]]*\])?(?:\([^)]*\))?: Video: ([a-zA-Z0-9_]+)[^\n]*?(\d{2,5})x(\d{2,5})/.exec(stderr);
  const audioMatch = /Stream #\d+:\d+(?:\[[^\]]*\])?(?:\([^)]*\))?: Audio: ([a-zA-Z0-9_]+)/.exec(stderr);
  const ext = path.extname(fileName).replace('.', '').toLowerCase() || null;

  return {
    durationSeconds: durationSeconds && Number.isFinite(durationSeconds) ? durationSeconds : null,
    width: videoMatch ? Number(videoMatch[2]) : null,
    height: videoMatch ? Number(videoMatch[3]) : null,
    videoCodec: videoMatch ? videoMatch[1].toLowerCase() : null,
    audioCodec: audioMatch ? audioMatch[1].toLowerCase() : null,
    hasAudio: Boolean(audioMatch),
    container: ext,
  };
}

async function probe(inputPath: string): Promise<Probe> {
  // Probing with no output makes ffmpeg exit 1 after printing the input; the
  // exit code is not an error here.
  const { stderr } = await runFfmpeg(['-hide_banner', '-i', inputPath], 60_000);
  return parseProbeOutput(stderr, inputPath);
}

export function aspectRatioOf(width: number | null, height: number | null): string | null {
  if (!width || !height) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  // Common near-ratios read better than 1080:1920 style fractions.
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(ratio - 1) < 0.02) return '1:1';
  if (Math.abs(ratio - 4 / 5) < 0.02) return '4:5';
  return `${w}:${h}`;
}

/**
 * Already the rendition we would produce: H.264 in MP4, at most 1080p on the
 * short side (so 1080x1920 portrait and 1920x1080 landscape both qualify).
 */
export function isWebReady(probe: Probe): boolean {
  const short = Math.min(probe.width ?? 0, probe.height ?? 0);
  const long = Math.max(probe.width ?? 0, probe.height ?? 0);
  return (
    probe.container === 'mp4' &&
    probe.videoCodec === 'h264' &&
    (probe.audioCodec === null || probe.audioCodec === 'aac') &&
    short <= 1080 &&
    long <= 1920
  );
}

// Cap the short side at 1080 and the long side at 1920 whichever way the
// frame is turned; -2 keeps the other dimension proportional and even.
const RENDITION_SCALE = "scale='if(gt(iw,ih),min(iw,1920),min(iw,1080))':-2";

/**
 * The ffmpeg filter for a duet: the reply on the left, the original on the
 * right, each fitted into a 540x960 portrait half, and the two soundtracks
 * mixed when both exist. Input 0 is the reply, input 1 the original.
 */
export function duetFilter(replyHasAudio: boolean, originalHasAudio: boolean): { filter: string; maps: string[] } {
  const fit = 'scale=540:960:force_original_aspect_ratio=increase,crop=540:960,setsar=1';
  let filter = `[0:v]${fit}[l];[1:v]${fit}[r];[l][r]hstack=inputs=2[v]`;
  const maps = ['-map', '[v]'];
  if (replyHasAudio && originalHasAudio) {
    filter += ';[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=0[a]';
    maps.push('-map', '[a]');
  } else if (replyHasAudio) {
    maps.push('-map', '0:a');
  } else if (originalHasAudio) {
    maps.push('-map', '1:a');
  }
  return { filter, maps };
}

async function downloadToTemp(url: string, dir: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch the upload (${response.status})`);
  const ext = path.extname(new URL(url).pathname) || '.bin';
  const target = path.join(dir, `source${ext}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(target, bytes);
  return target;
}

async function setProgress(videoId: string, authorId: string, processingProgress: number, stage: string) {
  await prisma.video.update({ where: { id: videoId }, data: { processingProgress } });
  emitToUserRoom(authorId, 'video:progress', { videoId, progress: processingProgress, stage });
}

async function publish(
  videoId: string,
  authorId: string,
  data: Record<string, unknown>,
  processingError: string | null
) {
  const updated = await prisma.video.update({
    where: { id: videoId },
    data: {
      ...data,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      processedAt: new Date(),
      processingProgress: 100,
      processingError,
    },
  });
  emitToUserRoom(authorId, 'video:processed', {
    videoId,
    status: 'PUBLISHED',
    processingError,
    thumbnailUrl: updated.thumbnailUrl,
    duration: updated.duration,
  });
  return updated;
}

/**
 * Runs the whole pipeline for one video. Safe to call again for a video that
 * is already published (it re-processes it); never throws.
 */
export async function processVideo(videoId: string): Promise<void> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      authorId: true,
      videoUrl: true,
      sourceUrl: true,
      thumbnailUrl: true,
      duration: true,
      audioTrackId: true,
      duetOfVideoId: true,
      author: { select: { displayName: true, firstName: true, lastName: true } },
    },
  });
  if (!video) return;

  const inputUrl = video.sourceUrl || video.videoUrl;

  if (!isFfmpegAvailable()) {
    logger.warn('ffmpeg unavailable; publishing the upload as received', { videoId });
    await publish(videoId, video.authorId, {}, 'ffmpeg is not available on this host; the upload was published as received');
    return;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `athena-video-${videoId.slice(0, 8)}-`));
  const outputs: Record<string, unknown> = {};
  let failure: string | null = null;

  try {
    await prisma.video.update({ where: { id: videoId }, data: { status: 'PROCESSING', processingError: null } });
    await setProgress(videoId, video.authorId, 5, 'fetching');

    let inputPath = localPathForUrl(inputUrl) ?? (await downloadToTemp(inputUrl, workDir));
    let composedDuet = false;

    // 0. duet: compose the reply beside the original before anything else,
    //    so the poster, the rendition and the probe all describe the result.
    if (video.duetOfVideoId) {
      const original = await prisma.video.findUnique({
        where: { id: video.duetOfVideoId },
        select: { videoUrl: true },
      });
      if (original?.videoUrl) {
        const originalDir = fs.mkdtempSync(path.join(workDir, 'original-'));
        const originalPath = localPathForUrl(original.videoUrl) ?? (await downloadToTemp(original.videoUrl, originalDir));
        const [replyInfo, originalInfo] = await Promise.all([probe(inputPath), probe(originalPath)]);
        const { filter, maps } = duetFilter(replyInfo.hasAudio, originalInfo.hasAudio);
        const duetPath = path.join(workDir, 'duet.mp4');
        const duet = await runFfmpeg([
          '-hide_banner',
          '-y',
          '-i',
          inputPath,
          '-i',
          originalPath,
          '-filter_complex',
          filter,
          ...maps,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          ...(replyInfo.hasAudio || originalInfo.hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : []),
          '-shortest',
          '-movflags',
          '+faststart',
          duetPath,
        ]);
        if (duet.code === 0 && fs.existsSync(duetPath)) {
          inputPath = duetPath;
          composedDuet = true;
          outputs.sourceUrl = inputUrl;
        } else {
          failure = `Duet could not be composed; the reply was published on its own (${duet.stderr.trim().split('\n').pop() ?? 'no detail'})`;
          logger.warn('Duet compose failed', { videoId, tail: duet.stderr.slice(-300) });
        }
      }
    }
    await setProgress(videoId, video.authorId, 12, composedDuet ? 'duet' : 'fetching');

    // 1. probe
    const info = await probe(inputPath);
    if (info.durationSeconds) outputs.duration = Math.max(1, Math.round(info.durationSeconds));
    if (info.width && info.height) {
      outputs.width = info.width;
      outputs.height = info.height;
      outputs.aspectRatio = aspectRatioOf(info.width, info.height);
    }
    await setProgress(videoId, video.authorId, 20, 'probed');

    // 2. poster frame
    if (!video.thumbnailUrl) {
      const posterPath = path.join(workDir, 'poster.jpg');
      const at = Math.min(1, Math.max(0, (info.durationSeconds ?? 2) / 2));
      const poster = await runFfmpeg(
        ['-hide_banner', '-y', '-ss', String(at), '-i', inputPath, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', posterPath],
        120_000
      );
      if (poster.code === 0 && fs.existsSync(posterPath)) {
        outputs.thumbnailUrl = await storeFile(`thumbnails/${video.authorId}/${videoId}.jpg`, posterPath, 'image/jpeg');
      } else {
        logger.warn('Poster frame failed', { videoId, tail: poster.stderr.slice(-300) });
      }
    }
    await setProgress(videoId, video.authorId, 45, 'poster');

    // 3. web rendition. A composed duet already is one; it just needs storing.
    if (composedDuet) {
      outputs.videoUrl = await storeFile(`videos/${video.authorId}/${videoId}-web.mp4`, inputPath, 'video/mp4');
    } else if (!isWebReady(info)) {
      const renditionPath = path.join(workDir, 'web.mp4');
      const rendition = await runFfmpeg([
        '-hide_banner',
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-vf',
        RENDITION_SCALE,
        '-pix_fmt',
        'yuv420p',
        ...(info.hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
        '-movflags',
        '+faststart',
        renditionPath,
      ]);
      if (rendition.code === 0 && fs.existsSync(renditionPath)) {
        outputs.sourceUrl = inputUrl;
        outputs.videoUrl = await storeFile(`videos/${video.authorId}/${videoId}-web.mp4`, renditionPath, 'video/mp4');
      } else {
        failure = `Transcode failed; the upload was published as received (${rendition.stderr.trim().split('\n').pop() ?? 'no detail'})`;
        logger.warn('Transcode failed', { videoId, tail: rendition.stderr.slice(-300) });
      }
    }
    await setProgress(videoId, video.authorId, 85, 'rendition');

    // 4. original sound. A duet's mix is not a sound of its own.
    if (info.hasAudio && !video.audioTrackId && !composedDuet) {
      const audioPath = path.join(workDir, 'sound.m4a');
      const audio = await runFfmpeg(
        ['-hide_banner', '-y', '-i', inputPath, '-vn', '-c:a', 'aac', '-b:a', '128k', audioPath],
        5 * 60 * 1000
      );
      if (audio.code === 0 && fs.existsSync(audioPath)) {
        const audioUrl = await storeFile(`sounds/${video.authorId}/${videoId}.m4a`, audioPath, 'audio/mp4');
        const authorName =
          video.author.displayName?.trim() ||
          [video.author.firstName, video.author.lastName].filter(Boolean).join(' ').trim() ||
          'ATHENA member';
        const existing = await prisma.audioTrack.findUnique({ where: { sourceVideoId: videoId }, select: { id: true } });
        const track = existing
          ? await prisma.audioTrack.update({
              where: { id: existing.id },
              data: { audioUrl, duration: Number(outputs.duration ?? video.duration ?? 1) },
              select: { id: true },
            })
          : await prisma.audioTrack.create({
              data: {
                title: `Original sound - ${authorName}`,
                artist: authorName,
                audioUrl,
                duration: Number(outputs.duration ?? video.duration ?? 1),
                isOriginal: true,
                licenseType: 'original',
                coverUrl: (outputs.thumbnailUrl as string | undefined) ?? video.thumbnailUrl,
                createdById: video.authorId,
                sourceVideoId: videoId,
                useCount: 1,
              },
              select: { id: true },
            });
        outputs.audioTrackId = track.id;
      } else {
        logger.warn('Audio extraction failed', { videoId, tail: audio.stderr.slice(-300) });
      }
    }
    await setProgress(videoId, video.authorId, 95, 'sound');
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    logger.error('Video pipeline failed; publishing as received', { videoId, error: failure });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  await publish(videoId, video.authorId, outputs, failure);
}

// ===========================================
// In-process queue
// ===========================================

const pending: string[] = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (pending.length > 0) {
      const next = pending.shift()!;
      await processVideo(next).catch((error) => {
        logger.error('Video pipeline crashed', { videoId: next, error: error instanceof Error ? error.message : String(error) });
      });
    }
  } finally {
    draining = false;
  }
}

/**
 * Hands a newly created video to the pipeline. Returns immediately; the
 * client follows progress on GET /video/:id/processing and over the socket.
 * With VIDEO_PIPELINE=off (tests, hosts with no scratch disk) the reel is
 * published as uploaded, which is what the platform did before the pipeline
 * existed.
 */
export function enqueueVideoProcessing(videoId: string, authorId: string): void {
  if (process.env.VIDEO_PIPELINE === 'off' || process.env.NODE_ENV === 'test') {
    publish(videoId, authorId, {}, null).catch((error) => {
      logger.error('Publishing without the pipeline failed', { videoId, error: error instanceof Error ? error.message : String(error) });
    });
    return;
  }
  pending.push(videoId);
  setImmediate(() => void drain());
}

export function pipelineQueueLength(): number {
  return pending.length + (draining ? 1 : 0);
}
