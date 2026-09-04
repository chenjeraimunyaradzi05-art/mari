/**
 * Groups a page of notifications so a busy post reads as one row: "Mei C.
 * and 4 others reacted to your post" rather than five rows that say the same
 * thing. Grouping only ever joins rows that carry their actor (written since
 * social notifications started recording one); older rows stay as they are.
 *
 * A group keeps every id it folded, so the client can mark all of them read
 * with one action, and is unread if any member is.
 */

export interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  data: unknown;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface GroupedNotification extends NotificationRow {
  ids: string[];
  count: number;
  actors: string[];
}

const GROUPABLE = new Set(['LIKE', 'COMMENT', 'FOLLOW', 'MENTION', 'REPOST']);
const WINDOW_MS = 48 * 60 * 60 * 1000;

function actorNameOf(row: NotificationRow): string | null {
  const data = row.data as { actorName?: unknown } | null;
  const name = data && typeof data === 'object' ? data.actorName : undefined;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/** "Mei C. celebrated your post" -> "celebrated your post". */
function tailOf(row: NotificationRow, actor: string): string {
  const message = row.message ?? '';
  return message.startsWith(actor) ? message.slice(actor.length).trim() : message;
}

function groupKey(row: NotificationRow): string {
  // Follows all land on "your followers"; everything else groups per target.
  return row.type === 'FOLLOW' ? 'FOLLOW' : `${row.type}|${row.link ?? ''}`;
}

function genericTail(type: string): string {
  switch (type) {
    case 'LIKE':
      return 'reacted to your post';
    case 'COMMENT':
      return 'commented on your post';
    case 'FOLLOW':
      return 'started following you';
    case 'MENTION':
      return 'mentioned you';
    case 'REPOST':
      return 'reposted your post';
    default:
      return '';
  }
}

export function groupNotifications(rows: NotificationRow[]): GroupedNotification[] {
  const out: GroupedNotification[] = [];
  const open = new Map<string, GroupedNotification & { tails: Set<string>; newest: number }>();

  for (const row of rows) {
    const actor = actorNameOf(row);
    if (!GROUPABLE.has(row.type) || !actor) {
      out.push({ ...row, ids: [row.id], count: 1, actors: actor ? [actor] : [] });
      continue;
    }

    const key = groupKey(row);
    const existing = open.get(key);
    if (existing && existing.newest - row.createdAt.getTime() <= WINDOW_MS) {
      existing.ids.push(row.id);
      existing.count += 1;
      if (!existing.actors.includes(actor)) existing.actors.push(actor);
      existing.tails.add(tailOf(row, actor));
      existing.isRead = existing.isRead && row.isRead;
      continue;
    }

    const group = {
      ...row,
      ids: [row.id],
      count: 1,
      actors: [actor],
      tails: new Set([tailOf(row, actor)]),
      newest: row.createdAt.getTime(),
    };
    open.set(key, group);
    out.push(group);
  }

  // Compose the message for anything that actually grouped.
  return out.map((item) => {
    const group = item as GroupedNotification & { tails?: Set<string>; newest?: number };
    const { tails, newest: _newest, ...rest } = group;
    if (rest.count <= 1 || !tails) return rest;

    const distinctActors = rest.actors;
    const others = rest.count - 1;
    const tail = tails.size === 1 ? Array.from(tails)[0] : genericTail(rest.type);
    const lead =
      distinctActors.length === 1
        ? distinctActors[0]
        : distinctActors.length === 2 && rest.count === 2
          ? `${distinctActors[0]} and ${distinctActors[1]}`
          : `${distinctActors[0]} and ${others} ${others === 1 ? 'other' : 'others'}`;
    return { ...rest, message: `${lead} ${tail}`.trim() };
  });
}
