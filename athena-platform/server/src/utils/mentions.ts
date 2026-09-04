/**
 * @mentions.
 *
 * Members have no unique handle (display names collide), so a mention is
 * written into the text as @[Display Name](userId): the name is what people
 * read, the id is what resolves. The composer inserts that form from its
 * autocomplete; renderers turn it back into a link with the name; this module
 * pulls the ids out so the people named can be notified.
 */

import { prisma } from './prisma';

export const MENTION_PATTERN = /@\[([^\]\n]{1,80})\]\(([0-9a-fA-F-]{36})\)/g;

export interface Mention {
  name: string;
  userId: string;
}

export function extractMentions(text: string | null | undefined): Mention[] {
  if (!text) return [];
  const seen = new Set<string>();
  const mentions: Mention[] = [];
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const userId = match[2];
    if (seen.has(userId)) continue;
    seen.add(userId);
    mentions.push({ name: match[1].trim(), userId });
  }
  return mentions;
}

/** The mentioned ids that name real members, capped so a post cannot page everyone. */
export async function resolveMentionedUserIds(text: string | null | undefined, limit = 20): Promise<string[]> {
  const ids = extractMentions(text)
    .map((m) => m.userId)
    .slice(0, limit);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  });
  const valid = new Set(users.map((u) => u.id));
  return ids.filter((id) => valid.has(id));
}

/** The text as it reads aloud: "@[Mei Chen](id)" becomes "@Mei Chen". */
export function mentionsToPlainText(text: string): string {
  return text.replace(MENTION_PATTERN, (_match, name: string) => `@${name}`);
}
