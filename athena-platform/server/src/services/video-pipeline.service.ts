/**
 * The video processing pipeline.
 *
 * A reel is created PROCESSING and becomes PUBLISHED here. For each one:
 *
 *   1. probe      duration, dimensions, codecs, whether there is audio
 *   2. poster     a frame one second in, scaled to 720px wide, unless the
 *                 uploader already supplied a thumbnail
 *   3. rendition  H.264/AAC MP4 with the moov atom up front, capped at 1080
 *                 rows, unless the upload already is one, in which case it is
 *                 copied across without its metadata (a phone writes where it
 *                 was filmed into the file, and every step here drops it)
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
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { localPathForUrl, storeFile } from '../utils/media-storage';
import { fetchPublic } from '../utils/outbound-url';
import { tryQueueVideoProcessing } from '../utils/video-queue';
import { emitToUserRoom } from './socket.service';
import { checkContentAchievements } from './engagement.service';
import { publicName } from '../utils/member-display';

// The most a source video may be: the upload ceiling for videos. Anything
// larger is refused rather than read into memory or onto the disk.
const MAX_SOURCE_BYTES = 500 * 1024 * 1024;
const SOURCE_FETCH_TIMEOUT_MS = 2 * 60 * 1000;

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

// ===========================================
// Metadata
// ===========================================

/**
 * Why a file could not be cleaned of its metadata: ffmpeg exited without
 * writing it (unreadable: it is not the video or recording it says it is, or is
 * damaged), or there was no ffmpeg to ask (unavailable: nothing is wrong with the
 * file).
 */
export class MediaMetadataError extends Error {
  constructor(
    message: string,
    readonly reason: 'unreadable' | 'unavailable'
  ) {
    super(message);
    this.name = 'MediaMetadataError';
  }
}

/**
 * How each type a member can upload as video or sound is written back out.
 * The muxer is named rather than guessed from a file name, because the temporary
 * files have none, and `faststart` only exists for the MP4 family.
 */
const METADATA_STRIP_FORMATS: Record<string, { muxer: string; kind: 'video' | 'audio'; mp4Family: boolean }> = {
  'video/mp4': { muxer: 'mp4', kind: 'video', mp4Family: true },
  'video/quicktime': { muxer: 'mov', kind: 'video', mp4Family: true },
  'video/webm': { muxer: 'webm', kind: 'video', mp4Family: false },
  'audio/mp4': { muxer: 'mp4', kind: 'audio', mp4Family: true },
  'audio/x-m4a': { muxer: 'ipod', kind: 'audio', mp4Family: true },
  'audio/mpeg': { muxer: 'mp3', kind: 'audio', mp4Family: false },
  'audio/aac': { muxer: 'adts', kind: 'audio', mp4Family: false },
  'audio/wav': { muxer: 'wav', kind: 'audio', mp4Family: false },
  'audio/ogg': { muxer: 'ogg', kind: 'audio', mp4Family: false },
  'audio/webm': { muxer: 'webm', kind: 'audio', mp4Family: false },
};

/** Whether uploads of this type carry metadata that is dropped here. */
export function hasStrippableMetadata(contentType: string): boolean {
  return Object.prototype.hasOwnProperty.call(METADATA_STRIP_FORMATS, contentType);
}

/**
 * The ffmpeg arguments that copy a file's pictures and sound across untouched
 * and leave everything else behind: no global or stream tags (where a phone
 * writes the place it was filmed, the device and the title), no chapters, no
 * data tracks (some cameras record a GPS track alongside the picture) and no
 * cover art. Nothing is re-encoded, so it costs a disk copy, not a transcode,
 * and the picture is exactly what was sent. A phone's rotation is not a tag, it
 * is a property of the video stream, and a stream copy keeps it.
 */
export function stripMetadataArgs(inputPath: string, outputPath: string, contentType: string): string[] {
  const format = METADATA_STRIP_FORMATS[contentType];
  if (!format) throw new Error(`No metadata strip is defined for ${contentType}`);

  return [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    ...(format.kind === 'video' ? ['-map', '0:v:0', '-map', '0:a?'] : ['-map', '0:a']),
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-c',
    'copy',
    ...(format.mp4Family ? ['-movflags', '+faststart'] : []),
    // The muxer writes an ID3 header of its own whenever it is asked to.
    ...(format.muxer === 'mp3' ? ['-write_id3v2', '0'] : []),
    '-f',
    format.muxer,
    outputPath,
  ];
}

/**
 * Writes a copy of a video or recording without its metadata. Throws a
 * MediaMetadataError, and leaves no output file behind, when it cannot.
 */
export async function stripMediaMetadata(inputPath: string, outputPath: string, contentType: string): Promise<void> {
  if (!isFfmpegAvailable()) {
    throw new MediaMetadataError('ffmpeg is not available on this host', 'unavailable');
  }

  let result: { code: number; stderr: string };
  try {
    result = await runFfmpeg(stripMetadataArgs(inputPath, outputPath, contentType), 5 * 60 * 1000);
  } catch (error) {
    fs.rmSync(outputPath, { force: true });
    throw new MediaMetadataError(error instanceof Error ? error.message : String(error), 'unavailable');
  }

  const written = result.code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  if (!written) {
    fs.rmSync(outputPath, { force: true });
    throw new MediaMetadataError(
      `ffmpeg could not copy the file (${result.stderr.trim().split('\n').pop() ?? 'no detail'})`,
      'unreadable'
    );
  }
}

/**
 * One picture from a video, as a JPEG, or null when the file has nothing at that
 * time (it is shorter, or ffmpeg cannot read it). For the screening of what a
 * video shows (video-screening.service): the frame is looked at and thrown away.
 * Seeking before the input makes it a jump, not a decode from the start, so it
 * costs about as much for the last minute of a long video as for the first.
 */
export async function extractFrameJpeg(inputPath: string, atSeconds: number, timeoutMs = 30_000): Promise<Buffer | null> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-frame-'));
  const outputPath = path.join(workDir, 'frame.jpg');
  try {
    const result = await runFfmpeg(
      ['-hide_banner', '-y', '-ss', String(atSeconds), '-i', inputPath, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', outputPath],
      timeoutMs
    );
    if (result.code !== 0 || !fs.existsSync(outputPath)) return null;
    const frame = fs.readFileSync(outputPath);
    return frame.length > 0 ? frame : null;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/** The same, for a sound held in memory: through a scratch folder that is always removed. */
export async function stripMediaMetadataBuffer(body: Buffer, contentType: string): Promise<Buffer> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-strip-'));
  try {
    const inputPath = path.join(workDir, 'in');
    const outputPath = path.join(workDir, 'out');
    fs.writeFileSync(inputPath, body);
    await stripMediaMetadata(inputPath, outputPath, contentType);
    return fs.readFileSync(outputPath);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
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

/**
 * Fetches a source that is not on this host's own storage. The URL came
 * from the member who posted the reel, so it is fetched like any other
 * untrusted link: public hosts only, every redirect checked, a timeout, and
 * the bytes streamed to disk under a ceiling rather than read into memory.
 */
async function downloadToTemp(url: string, dir: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchPublic(url, { signal: controller.signal, headers: { accept: 'video/*,*/*;q=0.5' } });
    if (!response) throw new Error('The source is not a public address this server will fetch');
    if (!response.ok) throw new Error(`Could not fetch the upload (${response.status})`);

    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_SOURCE_BYTES) {
      // Cancelling the body is what hands the socket back for a response we
      // have just decided not to read; without it the connection sits open
      // until something else times it out, and a host that keeps offering
      // oversized sources leaks one every time. That made the old
      // `.catch(() => {})` the wrong shape twice over: it is the very failure
      // that would explain a slow drip of stuck sockets on this host, and it
      // was the one thing nobody could see. Started but not awaited, exactly as
      // before, so the ceiling below still refuses the upload immediately
      // rather than waiting on a stream we no longer care about. A thunk rather
      // than the promise, so that a body which refuses to be cancelled at all
      // is caught here too instead of escaping as a synchronous throw.
      void bestEffort('video-pipeline.cancel-oversized-source-body', () => response.body?.cancel());
      throw new Error(`The source is larger than the ${Math.round(MAX_SOURCE_BYTES / 1024 / 1024)} MB a reel may be`);
    }
    if (!response.body) throw new Error('The source returned no content');

    const ext = (path.extname(new URL(response.url || url).pathname) || '.bin').replace(/[^.a-z0-9]/gi, '').slice(0, 8) || '.bin';
    const target = path.join(dir, `source${ext}`);

    let received = 0;
    const ceiling = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > MAX_SOURCE_BYTES) {
          callback(new Error(`The source is larger than the ${Math.round(MAX_SOURCE_BYTES / 1024 / 1024)} MB a reel may be`));
          return;
        }
        callback(null, chunk);
      },
    });

    await pipeline(Readable.fromWeb(response.body as any), ceiling, fs.createWriteStream(target));
    return target;
  } finally {
    clearTimeout(timer);
  }
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

  // "First Steps" and "Video Star" count published reels, and a reel is
  // published here rather than when it is uploaded. Nothing used to run these
  // checks from anywhere, so a creator who posted nothing but reels held no
  // content achievement at all however many she made. The check reads counts
  // and awards only what is not already held, so re-processing a video that
  // was already published costs two counts and awards nothing.
  await bestEffort('video-pipeline.achievements', () => checkContentAchievements(authorId));

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
      author: { select: { displayName: true, firstName: true } },
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
          '-map_metadata',
          '-1',
          '-map_chapters',
          '-1',
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
        '-map_metadata',
        '-1',
        '-map_chapters',
        '-1',
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
    } else {
      // Already the rendition we would make, so nothing is re-encoded, but it
      // is still copied across without its metadata: a file from a phone, or
      // from a link the creator pasted, says where it was filmed, and this is
      // the copy that is played to everyone.
      const cleanPath = path.join(workDir, 'clean.mp4');
      try {
        await stripMediaMetadata(inputPath, cleanPath, 'video/mp4');
        outputs.sourceUrl = inputUrl;
        outputs.videoUrl = await storeFile(`videos/${video.authorId}/${videoId}-web.mp4`, cleanPath, 'video/mp4');
      } catch (error) {
        failure = `The upload could not be copied without its metadata; it was published as received (${error instanceof Error ? error.message : String(error)})`;
        logger.warn('Metadata strip failed', { videoId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    await setProgress(videoId, video.authorId, 85, 'rendition');

    // 4. original sound. A duet's mix is not a sound of its own.
    if (info.hasAudio && !video.audioTrackId && !composedDuet) {
      const audioPath = path.join(workDir, 'sound.m4a');
      const audio = await runFfmpeg(
        ['-hide_banner', '-y', '-i', inputPath, '-vn', '-map_metadata', '-1', '-c:a', 'aac', '-b:a', '128k', audioPath],
        5 * 60 * 1000
      );
      if (audio.code === 0 && fs.existsSync(audioPath)) {
        const audioUrl = await storeFile(`sounds/${video.authorId}/${videoId}.m4a`, audioPath, 'audio/mp4');
        // Listed under her public name, else her first name alone, never her legal surname.
        const authorName = publicName(video.author, 'ATHENA member');
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
  // Durable first. With the workers running in this process the reel goes on
  // the BullMQ video queue, which Redis holds across a restart (see
  // utils/video-queue). Every "no" — no workers here, Redis down or slow —
  // is a clean false, and the reel falls back to the in-memory pipeline, so a
  // reel is never left with nobody to process it.
  void tryQueueVideoProcessing(videoId, authorId).then((queued) => {
    if (queued) return;
    pending.push(videoId);
    setImmediate(() => void drain());
  });
}

export function pipelineQueueLength(): number {
  return pending.length + (draining ? 1 : 0);
}
