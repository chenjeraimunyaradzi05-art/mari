import { Queue } from 'bullmq';
import { connection } from '@/lib/queue/connection';

export const VIDEO_QUEUE_NAME = 'video-transcode';

export const videoQueue = new Queue(VIDEO_QUEUE_NAME, { connection });

// Scheduler is no longer needed in BullMQ v5 (it's built-in)
// export const videoQueueScheduler = new QueueScheduler(VIDEO_QUEUE_NAME, { connection });


// videoQueueScheduler.waitUntilReady().catch((err) => {
//   console.error('Video queue scheduler failed to start', err);
// });
