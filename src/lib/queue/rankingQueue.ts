import { Queue } from 'bullmq';
import { connection } from './connection';

export const RANKING_QUEUE_NAME = 'ranking-train';

export const rankingQueue = new Queue(RANKING_QUEUE_NAME, { connection });
// export const rankingScheduler = new QueueScheduler(RANKING_QUEUE_NAME, { connection });
