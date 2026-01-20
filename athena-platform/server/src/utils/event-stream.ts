import { getRedisClient } from './cache';
import { logger } from './logger';
import { EventMessage, EventName, EventPayload } from '../types/events';

const STREAM_KEY = process.env.EVENT_STREAM_KEY || 'athena:events';
const DEFAULT_GROUP = process.env.EVENT_STREAM_GROUP || 'athena-services';
const DEFAULT_SOURCE = process.env.EVENT_STREAM_SOURCE || 'athena-server';

function nowIso() {
  return new Date().toISOString();
}

export async function publishEvent<T extends EventName>(
  event: T,
  payload: EventPayload<T>,
  source = DEFAULT_SOURCE
): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client) return false;

    await client.xadd(
      STREAM_KEY,
      '*',
      'event',
      event,
      'payload',
      JSON.stringify(payload),
      'timestamp',
      nowIso(),
      'source',
      source
    );

    return true;
  } catch (error) {
    logger.error('Event publish error', { event, error });
    return false;
  }
}

export async function ensureEventGroup(groupName = DEFAULT_GROUP): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.xgroup('CREATE', STREAM_KEY, groupName, '$', 'MKSTREAM');
  } catch (error: any) {
    if (error?.message?.includes('BUSYGROUP')) return;
    logger.error('Event group create error', { error });
  }
}

function parseEventMessage(record: any): EventMessage | null {
  if (!record || record.length < 2) return null;
  const [id, fields] = record as [string, string[]];
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    data[fields[i]] = fields[i + 1];
  }

  if (!data.event || !data.payload) return null;
  let payload: any = {};
  try {
    payload = JSON.parse(data.payload);
  } catch (error) {
    payload = {};
  }

  return {
    id,
    event: data.event as EventName,
    payload,
    timestamp: data.timestamp || nowIso(),
    source: data.source || DEFAULT_SOURCE,
  };
}

export async function consumeEvents(
  consumerName: string,
  handler: (event: EventMessage) => Promise<void>,
  options: { groupName?: string; count?: number; blockMs?: number } = {}
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  const groupName = options.groupName || DEFAULT_GROUP;
  const count = options.count || 10;
  const blockMs = options.blockMs || 5000;

  await ensureEventGroup(groupName);

  const response = await client.xreadgroup(
    'GROUP',
    groupName,
    consumerName,
    'COUNT',
    count,
    'BLOCK',
    blockMs,
    'STREAMS',
    STREAM_KEY,
    '>'
  );

  if (!response) return;
  const [, messages] = response[0];
  for (const message of messages) {
    const event = parseEventMessage(message);
    if (!event) continue;
    try {
      await handler(event);
      await client.xack(STREAM_KEY, groupName, event.id);
    } catch (error) {
      logger.error('Event handler error', { event: event.event, error });
    }
  }
}
