import { mkdir, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { uploadIfConfigured } from '@/lib/video/storage';
import { recordJobMetric } from '@/lib/metrics';

ffmpeg.setFfmpegPath(ffmpegPath);

const VARIANTS = [
  { quality: '1080p', bitrate: '5000k', scale: '1920:1080' },
  { quality: '720p', bitrate: '2500k', scale: '1280:720' },
  { quality: '480p', bitrate: '1000k', scale: '854:480' },
  { quality: '360p', bitrate: '500k', scale: '640:360' },
];

const HLS_SEGMENT_CACHE = 'public, max-age=31536000, immutable';
const HLS_MANIFEST_CACHE = 'public, max-age=60';
const HLS_CONTENT_TYPE = 'application/vnd.apple.mpegurl';
const HLS_SEGMENT_CONTENT_TYPE = 'video/mp2t';

export async function transcodeVideoAsset(videoId: string, inputPath: string) {
  const video = await prisma.videoAsset.findUnique({ where: { id: videoId } });
  if (!video) {
    throw new Error(`Video ${videoId} not found`);
  }

  const outputRoot = join(process.cwd(), '.uploads', 'transcoded', videoId);
  const hlsRoot = join(outputRoot, 'hls');
  await mkdir(outputRoot, { recursive: true });
  await mkdir(hlsRoot, { recursive: true });

  await prisma.videoProcessingQueue.update({
    where: { videoId },
    data: { status: 'processing', errorMessage: null },
  });

  try {
    let cdnUrl = video.cdnUrl || '';

    const masterEntries: { bandwidth: number; resolution: string; path: string; quality: string }[] = [];

    for (const variant of VARIANTS) {
      const variantDir = join(hlsRoot, variant.quality);
      await mkdir(variantDir, { recursive: true });
      const variantPlaylist = join(variantDir, `${variant.quality}.m3u8`);
      const segmentPattern = join(variantDir, `${variant.quality}_%03d.ts`);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .audioBitrate('128k')
          .size(variant.scale)
          .outputOptions([
            `-b:v ${variant.bitrate}`,
            '-preset veryfast',
            '-sc_threshold 0',
            '-g 48',
            '-keyint_min 48',
            '-hls_time 6',
            '-hls_playlist_type vod',
            '-hls_flags independent_segments',
            `-hls_segment_filename ${segmentPattern}`,
          ])
          .output(variantPlaylist)
          .on('end', () => resolve())
          .on('error', (err: unknown) => reject(err))
          .run();
      });

      const files = await readdir(variantDir);
      const segmentUploads = files
        .filter((f) => f.endsWith('.ts'))
        .map((file) => {
          const key = `videos/${videoId}/hls/${variant.quality}/${file}`;
          const fullPath = join(variantDir, file);
          return uploadIfConfigured(fullPath, key, HLS_SEGMENT_CONTENT_TYPE, HLS_SEGMENT_CACHE);
        });

      const playlistKey = `videos/${videoId}/hls/${variant.quality}/${variant.quality}.m3u8`;
      const playlistUpload = uploadIfConfigured(variantPlaylist, playlistKey, HLS_CONTENT_TYPE, HLS_MANIFEST_CACHE);

      const [playlistResult] = await Promise.all([playlistUpload, ...segmentUploads]);

      if (!cdnUrl) cdnUrl = playlistResult.url.replace(/\/[^/]+$/, '');

      masterEntries.push({
        bandwidth: parseInt(variant.bitrate.replace('k', '000'), 10),
        resolution: variant.scale.replace(':', 'x'),
        path: `${variant.quality}/${variant.quality}.m3u8`,
        quality: variant.quality,
      });

      await prisma.videoVariant.upsert({
        where: { videoId_quality: { videoId, quality: variant.quality } },
        create: {
          videoId,
          quality: variant.quality,
          bitrate: variant.bitrate,
          url: playlistResult.url,
        },
        update: {
          bitrate: variant.bitrate,
          url: playlistResult.url,
        },
      });
    }

    // Master playlist
    const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS'];
    for (const entry of masterEntries) {
      masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${entry.bandwidth},RESOLUTION=${entry.resolution}`);
      masterLines.push(entry.path);
    }

    const masterPlaylistPath = join(hlsRoot, 'master.m3u8');
    await writeFile(masterPlaylistPath, masterLines.join('\n'), 'utf-8');

    const masterKey = `videos/${videoId}/hls/master.m3u8`;
    const masterUpload = await uploadIfConfigured(masterPlaylistPath, masterKey, HLS_CONTENT_TYPE, HLS_MANIFEST_CACHE);
    if (!cdnUrl) cdnUrl = masterUpload.url.replace(/\/[^/]+$/, '');
    cdnUrl = masterUpload.url;

    await prisma.videoAsset.update({
      where: { id: videoId },
      data: {
        status: 'ready',
        cdnUrl: cdnUrl || `videos/${videoId}/hls/master.m3u8`,
        captionStatus: video.captionStatus ?? 'pending',
      },
    });

    await prisma.videoProcessingQueue.update({
      where: { videoId },
      data: { status: 'completed' },
    });

    recordJobMetric('video.transcode', true);
    logger.info('Transcode complete', { videoId, outputRoot, cdnUrl });
  } catch (error) {
    await prisma.videoProcessingQueue.update({
      where: { videoId },
      data: { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error) },
    });
    await prisma.videoAsset.update({
      where: { id: videoId },
      data: { status: 'failed' },
    });
    recordJobMetric('video.transcode', false);
    logger.error('Transcode failed', error instanceof Error ? error : new Error(String(error)), { videoId });
    throw error;
  }
}
