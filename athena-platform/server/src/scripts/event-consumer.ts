import { consumeEvents } from '../utils/event-stream';
import { logger } from '../utils/logger';

async function run() {
  const consumerName = process.env.EVENT_CONSUMER_NAME || `analytics-${process.pid}`;

  while (true) {
    await consumeEvents(consumerName, async (event) => {
      logger.info('Event received', { event: event.event, payload: event.payload });
    });
  }
}

run().catch((error) => {
  logger.error('Event consumer failed', { error });
  process.exit(1);
});
