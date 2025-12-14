import { Worker, JobsOptions } from 'bullmq';
import { connection } from '@/lib/queue/connection';
import { VIDEO_QUEUE_NAME, videoQueue } from '@/lib/queue/videoQueue';
import { prisma } from '@/lib/db';
import { transcodeVideoAsset } from '@/lib/video/transcoder';
import { requestCaptions } from '@/lib/video/captions';
import { logger } from '@/lib/logger';
import { recordJobMetric } from '@/lib/metrics';
import { sendAlert } from '@/lib/alerts';

const jobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: false,
};

export const videoWorker = new Worker(
  VIDEO_QUEUE_NAME,
  async (job) => {
    if (job.name === 'transcode') {
      const { videoId, inputPath } = job.data as { videoId: string; inputPath: string };

      await prisma.videoProcessingQueue.update({
        where: { videoId },
        data: { status: 'processing', errorMessage: null },
      });

      await transcodeVideoAsset(videoId, inputPath);

      // Enqueue captions after successful transcode
      await videoQueue.add(
        'captions',
        { videoId, mediaUrl: inputPath },
        jobOptions
      );

      recordJobMetric('video.transcode', true);
      return { videoId };
    }

    if (job.name === 'captions') {
      const { videoId, mediaUrl } = job.data as { videoId: string; mediaUrl: string };

      const { jobName } = await requestCaptions(videoId, mediaUrl);
      recordJobMetric('video.captions', true);
      return { videoId, jobName };
    }

    return {};
  },
  { connection }
);

videoWorker.on('completed', (job) => {
  logger.info('Video job completed', { jobId: job.id, videoId: job.data.videoId });
});

videoWorker.on('failed', async (job, err) => {
  if (job?.data?.videoId) {
    await prisma.videoProcessingQueue.update({
      where: { videoId: job.data.videoId },
      data: { status: 'failed', errorMessage: err.message },
    }).catch(() => undefined);
    await prisma.videoAsset.update({
      where: { id: job.data.videoId },
      data: { status: 'failed' },
    }).catch(() => undefined);
  }
  recordJobMetric('video.transcode', false);
  logger.error('Video job failed', err, { jobId: job?.id, videoId: job?.data?.videoId });
  await sendAlert('Video job failed', { jobId: job?.id, videoId: job?.data?.videoId, error: err.message });
});
