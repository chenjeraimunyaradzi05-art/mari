import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, LanguageCode } from '@aws-sdk/client-transcribe';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { uploadIfConfigured } from '@/lib/video/storage';
import { prisma } from '@/lib/db';
import { recordJobMetric } from '@/lib/metrics';
import { sendAlert } from '@/lib/alerts';

const transcribeRegion = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
const languageCode = process.env.TRANSCRIBE_LANGUAGE_CODE || 'en-US';
const transcribe = new TranscribeClient({ region: transcribeRegion });

export async function requestCaptions(videoId: string, mediaUrl: string) {
  const jobName = `captions-${videoId}-${randomUUID()}`;
  await prisma.videoAsset.update({ where: { id: videoId }, data: { captionStatus: 'processing' } });

  try {
    await transcribe.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: mediaUrl },
      MediaFormat: 'mp4',
      LanguageCode: languageCode as LanguageCode,
      OutputBucketName: process.env.S3_BUCKET,
      OutputKey: `captions/${videoId}/`,
    }));
    return { jobName };
  } catch (err) {
    logger.error('Failed to start caption job', err instanceof Error ? err : new Error(String(err)), { videoId });
    await prisma.videoAsset.update({ where: { id: videoId }, data: { captionStatus: 'failed' } });
    recordJobMetric('video.captions', false);
    await sendAlert('Caption job start failed', { videoId, error: String((err as Error)?.message ?? err) });
    throw err;
  }
}

export async function pollCaptions(jobName: string, videoId: string) {
  const resp = await transcribe.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
  const job = resp.TranscriptionJob;
  if (!job || !job.TranscriptionJobStatus) return { status: 'pending' } as const;

  if (job.TranscriptionJobStatus === 'FAILED') {
    await prisma.videoAsset.update({ where: { id: videoId }, data: { captionStatus: 'failed' } });
    recordJobMetric('video.captions', false);
    await sendAlert('Caption job failed', { videoId, reason: job.FailureReason });
    return { status: 'failed' } as const;
  }

  if (job.TranscriptionJobStatus === 'COMPLETED' && job.Transcript?.TranscriptFileUri) {
    const transcriptUrl = job.Transcript.TranscriptFileUri;
    await prisma.videoAsset.update({ where: { id: videoId }, data: { captionStatus: 'completed', captions: transcriptUrl } });
    recordJobMetric('video.captions', true);
    return { status: 'completed', url: transcriptUrl } as const;
  }

  return { status: 'processing' } as const;
}

// Fallback: generate a placeholder VTT if Transcribe not configured
export async function generatePlaceholderCaptions(videoId: string) {
  const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nCaptions not available.\n`;
  const tmpPath = `/tmp/${videoId}.vtt`;
  await uploadIfConfigured(tmpPath, `captions/${videoId}/placeholder.vtt`, 'text/vtt');
  return vtt;
}
