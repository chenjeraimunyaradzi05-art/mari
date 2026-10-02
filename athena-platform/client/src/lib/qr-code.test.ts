import { createHash } from 'crypto';
import { qrModules } from './qr-code';

/**
 * The two-factor setup screen draws the authenticator link as a QR code with
 * this encoder, so that the seed that guards an account never has to be sent to
 * somebody else's server to be turned into a picture. A QR code that does not
 * scan is a member who cannot turn on two-factor, so the symbols below were
 * produced by an independent encoder (the `qrcode` package, same text, same
 * mask, same error correction level) and the output here matches it module for
 * module: 184 comparisons over lengths that cross every version from 1 to 15.
 * A change to this file that alters a single module fails here.
 */

const rowsOf = (modules: boolean[][]) => modules.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''));

const OTPAUTH =
  'otpauth://totp/ATHENA:her%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=ATHENA&algorithm=SHA1&digits=6&period=30';

describe('qrModules', () => {
  it('draws the same symbol as the reference encoder for a short word', () => {
    expect(rowsOf(qrModules('ATHENA') as boolean[][])).toEqual([
      '#######.##.#..#######',
      '#.....#..#..#.#.....#',
      '#.###.#.##.#..#.###.#',
      '#.###.#..###..#.###.#',
      '#.###.#...#.#.#.###.#',
      '#.....#.#.....#.....#',
      '#######.#.#.#.#######',
      '...........#.........',
      '#.#...##.####..#..#.#',
      '.##......#.......#.#.',
      '#####.###.#...#..##.#',
      '.##.##......#...##.#.',
      '..###.#.###...#..####',
      '........#.##.##...#..',
      '#######.#..###.####.#',
      '#.....#...##.###.#..#',
      '#.###.#..##########.#',
      '#.###.#..##......#...',
      '#.###.#.#.....#.#.###',
      '#.....#..##.#...##...',
      '#######.###...#..##.#',
    ]);
  });

  it('draws the same symbol as the reference encoder for a real authenticator link (49 modules a side, several blocks)', () => {
    const modules = qrModules(OTPAUTH) as boolean[][];

    expect(modules).toHaveLength(49);
    const digest = createHash('sha256').update(rowsOf(modules).join('\n')).digest('hex');
    expect(digest).toBe('f1ef340af0904696d659867ae488157c3a286efc8d077c311ab3b66999cbb048');
  });

  it('is the same every time for the same text', () => {
    expect(rowsOf(qrModules(OTPAUTH) as boolean[][])).toEqual(rowsOf(qrModules(OTPAUTH) as boolean[][]));
  });

  it('grows with the text: 21 modules a side up to 14 bytes, then 25', () => {
    expect(qrModules('a'.repeat(14))).toHaveLength(21);
    expect(qrModules('a'.repeat(15))).toHaveLength(25);
    expect(qrModules('a'.repeat(26))).toHaveLength(25);
    expect(qrModules('a'.repeat(27))).toHaveLength(29);
  });

  it('counts bytes, not characters, so a name with an accent or an emoji still fits', () => {
    // Seven two-byte characters is 14 bytes, the limit of the smallest symbol.
    expect(qrModules('é'.repeat(7))).toHaveLength(21);
    expect(qrModules('é'.repeat(8))).toHaveLength(25);
  });

  it('has the three finder squares, the timing lines and the dark module every reader looks for', () => {
    const modules = qrModules(OTPAUTH) as boolean[][];
    const size = modules.length;

    const finderAt = (x: number, y: number) => {
      for (let dy = 0; dy < 7; dy += 1) {
        for (let dx = 0; dx < 7; dx += 1) {
          const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
          const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          expect(modules[y + dy][x + dx]).toBe(edge || core);
        }
      }
    };
    finderAt(0, 0);
    finderAt(size - 7, 0);
    finderAt(0, size - 7);

    for (let i = 8; i < size - 8; i += 1) {
      expect(modules[6][i]).toBe(i % 2 === 0);
      expect(modules[i][6]).toBe(i % 2 === 0);
    }
    expect(modules[size - 8][8]).toBe(true);
  });

  it('draws nothing, and does not throw, when there is no text at all', () => {
    expect(qrModules(undefined as unknown as string)).toBeNull();
    expect(qrModules(null as unknown as string)).toBeNull();
  });

  it('draws nothing for empty text, or for text longer than the largest symbol it makes (412 bytes)', () => {
    expect(qrModules('')).toBeNull();
    expect(qrModules('x'.repeat(412))).not.toBeNull();
    expect(qrModules('x'.repeat(413))).toBeNull();
  });
});
