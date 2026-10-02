/**
 * A QR code, made in the browser.
 *
 * Its one job is the two-factor setup screen: the authenticator seed arrives as
 * a link (`otpauth://totp/...`) and a phone app wants to scan it, not have it
 * typed in. It is written here, and not fetched from a "make me a QR code"
 * service, because what goes in is the seed that guards the account: the one
 * thing that must never leave her browser for somebody else's server.
 *
 * It is deliberately small. Byte mode (any text, as UTF-8), error correction
 * level M (about a sixth of the symbol may be damaged and it still scans),
 * versions 1 to 15, which is room for 412 bytes: an authenticator link is about
 * a hundred and fifty. Anything longer is not drawn, and the screen falls back to
 * the written seed and the link, which always work. The structure follows the
 * QR Code Model 2 standard (ISO/IEC 18004); qr-code.test.ts holds a golden
 * symbol made by an independent encoder, so a change that alters the output
 * fails there.
 */

/** Error correction blocks for level M, versions 1 to 15. */
const BLOCKS_M = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10];
/** Error correction codewords in total for level M, versions 1 to 15. */
const ECC_CODEWORDS_M = [10, 16, 26, 36, 48, 64, 72, 88, 110, 130, 150, 176, 198, 216, 240];
const MAX_VERSION = BLOCKS_M.length;
/** The two padding bytes the standard alternates to fill the data area. */
const PAD_BYTES = [0xec, 0x11];
/** Level M's two format bits. */
const FORMAT_BITS_M = 0;

// ------------------------------------------------------------ Reed-Solomon

const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}

function multiply(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** The generator polynomial of the given degree, highest term first, without its leading 1. */
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= multiply(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly.slice(1);
}

function remainder(data: number[], divisor: number[]): number[] {
  const result: number[] = new Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i += 1) result[i] ^= multiply(divisor[i], factor);
  }
  return result;
}

// ---------------------------------------------------------------- the sizes

/** Every codeword a symbol of this version holds, data and error correction together. */
function totalCodewords(version: number): number {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    modules -= (25 * align - 10) * align - 55;
    if (version >= 7) modules -= 36;
  }
  return Math.floor(modules / 8);
}

function dataCodewords(version: number): number {
  return totalCodewords(version) - ECC_CODEWORDS_M[version - 1];
}

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

// --------------------------------------------------------------------- data

/** The text as UTF-8 bytes. Written out because the test environment has no TextEncoder, and it is eight lines. */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

/** The data codewords for `bytes` at this version: mode, length, the bytes, a terminator and padding. */
function encodeData(bytes: number[], version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);

  const capacityBits = dataCodewords(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0; codewords.length < dataCodewords(version); pad += 1) {
    codewords.push(PAD_BYTES[pad % 2]);
  }
  return codewords;
}

/** Splits the data into blocks, adds each block's error correction and interleaves them. */
function addErrorCorrection(data: number[], version: number): number[] {
  const numBlocks = BLOCKS_M[version - 1];
  const raw = totalCodewords(version);
  const blockEccLen = ECC_CODEWORDS_M[version - 1] / numBlocks;
  const numShortBlocks = numBlocks - (raw % numBlocks);
  const shortBlockLen = Math.floor(raw / numBlocks);
  const divisor = generator(blockEccLen);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const block = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += block.length;
    const ecc = remainder(block, divisor);
    if (i < numShortBlocks) block.push(0);
    blocks.push(block.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => {
      // The padding slot in a short block is not a real codeword.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// ------------------------------------------------------------------ drawing

class QrSymbol {
  readonly size: number;
  readonly modules: boolean[][];
  private readonly isFunction: boolean[][];

  constructor(private readonly version: number, codewords: number[]) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.drawFunctionPatterns();
    this.drawCodewords(codewords);
  }

  private set(x: number, y: number, dark: boolean): void {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  private drawFunctionPatterns(): void {
    for (let i = 0; i < this.size; i += 1) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);

    const positions = this.alignmentPositions();
    const last = positions.length - 1;
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = 0; j < positions.length; j += 1) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        this.drawAlignment(positions[i], positions[j]);
      }
    }

    // Reserve the format area now; the real bits go in once the mask is chosen.
    this.drawFormat(0);
    this.drawVersion();
  }

  private alignmentPositions(): number[] {
    if (this.version === 1) return [];
    const count = Math.floor(this.version / 7) + 2;
    const step = Math.ceil((this.version * 4 + 4) / (count * 2 - 2)) * 2;
    const result = [6];
    for (let pos = this.size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.set(x, y, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  drawFormat(mask: number): void {
    const data = (FORMAT_BITS_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i += 1) this.set(8, i, getBit(bits, i));
    this.set(8, 7, getBit(bits, 6));
    this.set(8, 8, getBit(bits, 7));
    this.set(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i += 1) this.set(14 - i, 8, getBit(bits, i));

    for (let i = 0; i < 8; i += 1) this.set(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i += 1) this.set(8, this.size - 15 + i, getBit(bits, i));
    this.set(8, this.size - 8, true);
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, getBit(bits, i));
      this.set(b, a, getBit(bits, i));
    }
  }

  private drawCodewords(codewords: number[]): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < codewords.length * 8) {
            this.modules[y][x] = getBit(codewords[i >>> 3], 7 - (i & 7));
            i += 1;
          }
        }
      }
    }
  }

  /** Flips the data modules the mask names. Applying it twice puts them back. */
  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0; break;
          default: invert = ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0; break;
        }
        if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /** How hard a mask makes the symbol to read: long runs, blocks, finder look-alikes and imbalance score badly. */
  penalty(): number {
    const n = this.size;
    let result = 0;

    const finderLike = (history: number[]): number => {
      const unit = history[1];
      const core = unit > 0 && history[2] === unit && history[3] === unit * 3 && history[4] === unit && history[5] === unit;
      return (core && history[0] >= unit * 4 && history[6] >= unit ? 1 : 0) + (core && history[6] >= unit * 4 && history[0] >= unit ? 1 : 0);
    };
    const addRun = (length: number, history: number[]): void => {
      if (history[0] === 0) length += n;
      history.pop();
      history.unshift(length);
    };
    const scanLine = (at: (i: number) => boolean): number => {
      let score = 0;
      let color = false;
      let run = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < n; i += 1) {
        if (at(i) === color) {
          run += 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          addRun(run, history);
          if (!color) score += finderLike(history) * 40;
          color = at(i);
          run = 1;
        }
      }
      if (color) {
        addRun(run, history);
        run = 0;
      }
      run += n;
      addRun(run, history);
      return score + finderLike(history) * 40;
    };

    for (let y = 0; y < n; y += 1) result += scanLine((x) => this.modules[y][x]);
    for (let x = 0; x < n; x += 1) result += scanLine((y) => this.modules[y][x]);

    for (let y = 0; y < n - 1; y += 1) {
      for (let x = 0; x < n - 1; x += 1) {
        const color = this.modules[y][x];
        if (color === this.modules[y][x + 1] && color === this.modules[y + 1][x] && color === this.modules[y + 1][x + 1]) result += 3;
      }
    }

    let dark = 0;
    for (const row of this.modules) for (const cell of row) if (cell) dark += 1;
    const total = n * n;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  }
}

/**
 * The symbol for `text` as rows of modules, `true` for dark, with a given mask
 * (or, by default, whichever scores best). Null when the text is empty or too
 * long for a version 15 symbol at level M.
 */
export function qrModules(text: string, forcedMask?: number): boolean[][] | null {
  // An answer that arrives without the link is not a reason to take the page down.
  if (typeof text !== 'string') return null;
  const bytes = utf8(text);
  if (bytes.length === 0) return null;

  let version = 1;
  while (version <= MAX_VERSION) {
    const needed = 4 + (version <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= dataCodewords(version) * 8) break;
    version += 1;
  }
  if (version > MAX_VERSION) return null;

  const codewords = addErrorCorrection(encodeData(bytes, version), version);
  const symbol = new QrSymbol(version, codewords);

  let mask = forcedMask ?? 0;
  if (forcedMask === undefined) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate += 1) {
      symbol.applyMask(candidate);
      symbol.drawFormat(candidate);
      const score = symbol.penalty();
      if (score < best) {
        best = score;
        mask = candidate;
      }
      symbol.applyMask(candidate);
    }
  }
  symbol.applyMask(mask);
  symbol.drawFormat(mask);
  return symbol.modules;
}
