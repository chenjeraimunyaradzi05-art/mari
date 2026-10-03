/**
 * What the product may say about encryption.
 *
 * The wellness pages, the Safety Centre, the home page directory and the mobile
 * app all told members that their health data was "encrypted and read only by
 * you". It is encrypted before it is stored, but ATHENA's servers hold the key
 * and decrypt it to show it to her, so "only you can read it" is a promise that
 * encryption at rest cannot keep, and a woman deciding what to write down is
 * entitled to the real picture. The help centre went further and said all data
 * was AES-256 encrypted, and the wellness privacy page said deleting left "no
 * copy" while the database is backed up.
 *
 * Nine files said it, and nothing would have stopped a tenth. This reads every
 * source file the member can see and fails on the phrases that promise more
 * than the key arrangement allows. docs/runbooks/ENCRYPTION.md says what to
 * write instead.
 */

import fs from 'fs';
import path from 'path';

const ROOTS = [path.resolve(__dirname, '..'), path.resolve(__dirname, '..', '..', '..', 'mobile', 'src')];

const BANNED: Array<[RegExp, string]> = [
  [/read only by you/i, '"read only by you"'],
  [/only you can read (what you wrote|it|this)/i, '"only you can read it"'],
  // The same promise in a field hint: ATHENA's servers decrypt a note to show it to her.
  [/only you read (it|this|what)/i, '"only you read it"'],
  // A booking reason is shown to the practitioner, and ATHENA decrypts it for both of them.
  [/read by you and (this|the) practitioner only/i, '"read by you and the practitioner only"'],
  [/encryption \(AES-256\) for all data/i, 'encryption "for all data"'],
  [/end-to-end encrypt/i, '"end-to-end encrypted"'],
  // Habits, goals, the mental load log and forum posts are stored as typed.
  [/everything (health-related|here|in (the )?wellness) is encrypted/i, '"everything health-related is encrypted"'],
  [/there is no copy/i, '"there is no copy" (the database is backed up)'],
  [/military-grade/i, '"military-grade"'],
];

function sourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

describe('what members are told about encryption', () => {
  const files = ROOTS.flatMap(sourceFiles);

  it('reads the client and the mobile app, so a missing folder cannot make this pass', () => {
    expect(files.some((file) => file.includes(`${path.sep}wellness${path.sep}`))).toBe(true);
    expect(files.some((file) => file.includes(`${path.sep}mobile${path.sep}`))).toBe(true);
  });

  it('never promises that only she can read what encryption at rest keeps', () => {
    const offences: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const [pattern, label] of BANNED) {
        if (pattern.test(text)) offences.push(`${path.relative(path.resolve(__dirname, '..', '..', '..'), file)}: ${label}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('says plainly, where the wellness privacy page explains itself, that ATHENA decrypts what it shows her', () => {
    const page = fs.readFileSync(
      path.resolve(__dirname, '..', 'app', 'dashboard', 'wellness', 'settings', 'page.tsx'),
      'utf8'
    );
    expect(page).toMatch(/servers decrypt a record to show it to you/);
    expect(page).toMatch(/not from ATHENA/);
  });
});

/**
 * Messages are not end-to-end encrypted, and the product does not claim they are.
 *
 * A message is stored as plain text that the server writes and reads: direct
 * messages and group chats alike (Message.content), so that a reported message
 * can be shown to the team that reviews it and so that its words can be checked
 * for abuse before they are stored. Building client-side keys would take both
 * away, which is why the blueprint's "end-to-end encrypted messaging" is not
 * planned for launch, and why nothing a member reads may say it is. The
 * messaging copy says what is true instead: encrypted on the way to us and while
 * we store it, readable by ATHENA's systems, and read by the team only when a
 * message is reported or the law requires it.
 *
 * The first test pins what the guard refuses; the second reads every file a
 * member can see. A line that genuinely needs to say the words (a comment
 * explaining this very rule, say) carries `copy-claims: allow`, which is the
 * only way past it, and is visible in review.
 */
const ALLOW = 'copy-claims: allow';

// "end-to-end" with its hyphens is the encryption idiom; "take it end to end" is prose.
const END_TO_END_CLAIMS: RegExp[] = [/end-to-end/i, /\bE2EE?\b/];

export function findEndToEndClaims(text: string): Array<{ line: number; text: string }> {
  const found: Array<{ line: number; text: string }> = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.includes(ALLOW)) return;
    if (END_TO_END_CLAIMS.some((pattern) => pattern.test(line))) found.push({ line: index + 1, text: line.trim() });
  });
  return found;
}

describe('what members are told about who can read a message', () => {
  it('refuses a claim of end-to-end encryption, in any of the ways it is usually put', () => {
    for (const claim of [
      'Your chats are end-to-end encrypted.',
      'Messages are encrypted end-to-end',
      'End-to-end encryption for all messages',
      'We use E2EE for private chats',
      'Confidential mentorship conversations (E2E encrypted)',
    ]) {
      expect(findEndToEndClaims(`const copy = '${claim}';`)).toHaveLength(1);
    }
  });

  it('leaves ordinary prose alone, and a line that carries the allow comment', () => {
    expect(findEndToEndClaims('Take one report end to end.')).toEqual([]);
    expect(findEndToEndClaims('Run the end2end test suite')).toEqual([]);
    expect(findEndToEndClaims(`// this rule says "end-to-end" on purpose ${ALLOW}`)).toEqual([]);
  });

  it('reports the line, so a failure says where the claim is', () => {
    expect(findEndToEndClaims('one\ntwo\nWe offer end-to-end encryption\nfour')).toEqual([
      { line: 3, text: 'We offer end-to-end encryption' },
    ]);
  });

  it('finds no claim in anything a member can read, in the web app or the mobile app', () => {
    const root = path.resolve(__dirname, '..', '..', '..');
    const offences: string[] = [];
    for (const file of ROOTS.flatMap(sourceFiles)) {
      for (const hit of findEndToEndClaims(fs.readFileSync(file, 'utf8'))) {
        offences.push(`${path.relative(root, file)}:${hit.line}: ${hit.text}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
