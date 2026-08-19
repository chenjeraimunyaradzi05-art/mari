"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishEvent = publishEvent;
exports.ensureEventGroup = ensureEventGroup;
exports.consumeEvents = consumeEvents;
const cache_1 = require("./cache");
const logger_1 = require("./logger");
const STREAM_KEY = process.env.EVENT_STREAM_KEY || 'athena:events';
const DEFAULT_GROUP = process.env.EVENT_STREAM_GROUP || 'athena-services';
const DEFAULT_SOURCE = process.env.EVENT_STREAM_SOURCE || 'athena-server';
function nowIso() {
    return new Date().toISOString();
}
async function publishEvent(event, payload, source = DEFAULT_SOURCE) {
    try {
        const client = (0, cache_1.getRedisClient)();
        if (!client)
            return false;
        await client.xadd(STREAM_KEY, '*', 'event', event, 'payload', JSON.stringify(payload), 'timestamp', nowIso(), 'source', source);
        return true;
    }
    catch (error) {
        logger_1.logger.error('Event publish error', { event, error });
        return false;
    }
}
async function ensureEventGroup(groupName = DEFAULT_GROUP) {
    const client = (0, cache_1.getRedisClient)();
    if (!client)
        return;
    try {
        await client.xgroup('CREATE', STREAM_KEY, groupName, '$', 'MKSTREAM');
    }
    catch (error) {
        if (error?.message?.includes('BUSYGROUP'))
            return;
        logger_1.logger.error('Event group create error', { error });
    }
}
function parseEventMessage(record) {
    if (!record || record.length < 2)
        return null;
    const [id, fields] = record;
    const data = {};
    for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
    }
    if (!data.event || !data.payload)
        return null;
    let payload = {};
    try {
        payload = JSON.parse(data.payload);
    }
    catch (error) {
        payload = {};
    }
    return {
        id,
        event: data.event,
        payload,
        timestamp: data.timestamp || nowIso(),
        source: data.source || DEFAULT_SOURCE,
    };
}
async function consumeEvents(consumerName, handler, options = {}) {
    const client = (0, cache_1.getRedisClient)();
    if (!client)
        return;
    const groupName = options.groupName || DEFAULT_GROUP;
    const count = options.count || 10;
    const blockMs = options.blockMs || 5000;
    await ensureEventGroup(groupName);
    const response = await client.xreadgroup('GROUP', groupName, consumerName, 'COUNT', count, 'BLOCK', blockMs, 'STREAMS', STREAM_KEY, '>');
    if (!response)
        return;
    const [, messages] = response[0];
    for (const message of messages) {
        const event = parseEventMessage(message);
        if (!event)
            continue;
        try {
            await handler(event);
            await client.xack(STREAM_KEY, groupName, event.id);
        }
        catch (error) {
            logger_1.logger.error('Event handler error', { event: event.event, error });
        }
    }
}
//# sourceMappingURL=event-stream.js.map