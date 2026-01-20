"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const event_stream_1 = require("../utils/event-stream");
const logger_1 = require("../utils/logger");
async function run() {
    const consumerName = process.env.EVENT_CONSUMER_NAME || `analytics-${process.pid}`;
    while (true) {
        await (0, event_stream_1.consumeEvents)(consumerName, async (event) => {
            logger_1.logger.info('Event received', { event: event.event, payload: event.payload });
        });
    }
}
run().catch((error) => {
    logger_1.logger.error('Event consumer failed', { error });
    process.exit(1);
});
//# sourceMappingURL=event-consumer.js.map