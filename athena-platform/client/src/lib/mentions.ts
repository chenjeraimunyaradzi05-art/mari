/**
 * @mentions on the client.
 *
 * What people type and read is "@Mei Chen". What is stored is
 * "@[Mei Chen](userId)", because display names are not unique and the id is
 * what resolves. The composer keeps the readable form in its textarea and a
 * list of who was picked; serializeMentions() converts to the stored form on
 * submit, and the renderer turns the stored form back into a link.
 */

export interface MentionPick {
  id: string;
  name: string;
}

export const MENTION_MARKUP = /@\[([^\]\n]{1,80})\]\(([0-9a-fA-F-]{36})\)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "@Mei Chen" in the text becomes "@[Mei Chen](id)" for each pick, longest names first. */
export function serializeMentions(text: string, picks: MentionPick[]): string {
  let out = text;
  const ordered = [...picks].sort((a, b) => b.name.length - a.name.length);
  for (const pick of ordered) {
    const pattern = new RegExp(`(^|[^\\w\\[])@${escapeRegExp(pick.name)}(?![\\w\\]])`, 'g');
    out = out.replace(pattern, (_m, lead: string) => `${lead}@[${pick.name}](${pick.id})`);
  }
  return out;
}

/** The stored form back to what people read, for previews and edit boxes. */
export function mentionsToPlainText(text: string): string {
  return text.replace(MENTION_MARKUP, (_m, name: string) => `@${name}`);
}

/**
 * The @query being typed at the caret, if any: the text after the last "@"
 * that is at a word start and contains no line break, up to 40 characters.
 */
export function activeMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && /[\w\]]/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\n\]]/.test(query)) return null;
  return { query, start: at };
}
