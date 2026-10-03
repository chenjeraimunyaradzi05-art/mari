/**
 * @jest-environment node
 */

/**
 * The web app's Permissions-Policy is declared in three places that all ship:
 * the headers() block in next.config.js, public/_headers and the client's
 * netlify.toml. A browser that receives more than one policy enforces every
 * one of them, so the strictest layer wins and a feature any one of them
 * refuses is refused everywhere. That is how microphone=() in all three made
 * every voice note (components/chat/VoiceRecorder.tsx) and every interview
 * coach recording (app/dashboard/ai/interview-coach/page.tsx) fail with a
 * permission error while the buttons stayed on screen.
 *
 * Two things are held here: the three strings are identical, and the policy
 * allows exactly the features the client code asks the browser for. A new
 * camera or location feature fails this test until the policy is widened in
 * all three files; a widened policy that nothing uses fails it too.
 */

import fs from 'fs';
import path from 'path';

const CLIENT = path.resolve(__dirname, '..', '..');
const SRC = path.join(CLIENT, 'src');

const STRIPE_FRAME = '"https://js.stripe.com"';

/** Each layer's Permissions-Policy value, read the way it is actually declared. */
async function declaredPolicies(): Promise<Record<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- next.config.js is CommonJS
  const config = require('../../next.config.js');
  const rules: Array<{ source: string; headers: Array<{ key: string; value: string }> }> = await config.headers();
  const everyPath = rules.find((rule) => rule.source === '/(.*)');
  const fromNext = everyPath?.headers.find((header) => header.key === 'Permissions-Policy')?.value;

  // The value holds double quotes, so in TOML it is either a literal string
  // ('...') or a basic string ("...") with the quotes escaped.
  const toml = fs.readFileSync(path.join(CLIENT, 'netlify.toml'), 'utf8');
  const tomlMatch = toml.match(/^\s*Permissions-Policy\s*=\s*(?:'([^'\n]*)'|"((?:[^"\\\n]|\\.)*)")\s*$/m);
  const fromNetlify = tomlMatch ? (tomlMatch[1] ?? tomlMatch[2].replace(/\\(.)/g, '$1')) : undefined;

  const headersFile = fs.readFileSync(path.join(CLIENT, 'public', '_headers'), 'utf8');
  const fromHeaders = headersFile.match(/^\s+Permissions-Policy:\s*(.+?)\s*$/m)?.[1];

  return {
    'next.config.js': fromNext ?? '',
    'netlify.toml': fromNetlify ?? '',
    'public/_headers': fromHeaders ?? '',
  };
}

/** Whitespace is the only thing allowed to differ between the three files. */
function normalise(policy: string): string {
  return policy.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

/** `camera=(), microphone=(self)` becomes { camera: [], microphone: ['self'] }. */
function directives(policy: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const match of normalise(policy).matchAll(/([a-z-]+)=\(([^()]*)\)/g)) {
    out[match[1]] = match[2].split(/\s+/).filter(Boolean);
  }
  return out;
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Which source files ask the browser for each policy-controlled feature. */
function featuresUsed(): Record<string, string[]> {
  const uses: Record<string, string[]> = { microphone: [], camera: [], geolocation: [], 'display-capture': [], payment: [] };
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(SRC, file).split(path.sep).join('/');
    for (const call of text.matchAll(/getUserMedia\(\s*\{([^}]*)\}/g)) {
      if (/\baudio\b/.test(call[1])) uses.microphone.push(relative);
      if (/\bvideo\b/.test(call[1])) uses.camera.push(relative);
    }
    if (/navigator\.geolocation\b/.test(text)) uses.geolocation.push(relative);
    if (/getDisplayMedia\(/.test(text)) uses['display-capture'].push(relative);
    // Stripe's elements render the Apple Pay and Google Pay buttons inside a
    // frame on js.stripe.com, which uses the Payment Request API.
    if (/@stripe\/react-stripe-js/.test(text)) uses.payment.push(relative);
  }
  return uses;
}

describe('the web Permissions-Policy', () => {
  let policies: Record<string, string>;

  beforeAll(async () => {
    policies = await declaredPolicies();
  });

  it('is declared in all three layers', () => {
    const silent = Object.entries(policies)
      .filter(([, value]) => !value)
      .map(([layer]) => layer);
    expect(silent).toEqual([]);
  });

  it('is the same string in all three, because a browser enforces every policy it is given', () => {
    const reference = normalise(policies['next.config.js']);
    expect(normalise(policies['netlify.toml'])).toBe(reference);
    expect(normalise(policies['public/_headers'])).toBe(reference);
  });

  it('is well formed and decides each feature the client could use', () => {
    const policy = normalise(policies['next.config.js']);
    expect(policy).toMatch(/^[a-z-]+=\([^()]*\)(, [a-z-]+=\([^()]*\))*$/);
    expect(Object.keys(directives(policy))).toEqual(
      expect.arrayContaining(['camera', 'microphone', 'geolocation', 'payment', 'display-capture'])
    );
  });

  it('allows the microphone to this origin only, so voice notes and the interview coach can record', () => {
    expect(directives(policies['next.config.js']).microphone).toEqual(['self']);
    // The reason it is allowed: these are the recorders.
    expect(featuresUsed().microphone).toEqual(
      expect.arrayContaining(['components/chat/VoiceRecorder.tsx', 'app/dashboard/ai/interview-coach/page.tsx'])
    );
  });

  it('allows exactly the device features the client asks the browser for', () => {
    const policy = directives(policies['next.config.js']);
    const used = featuresUsed();
    // A feature left out of the header falls back to the browser's default,
    // which lets this origin use it, so an undeclared feature counts as open.
    const decided = ['camera', 'microphone', 'geolocation', 'display-capture'].map((feature) => ({
      feature,
      open: (policy[feature] ?? ['self']).length > 0,
      usedBy: used[feature],
    }));
    expect(decided).toEqual(
      decided.map(({ feature, usedBy }) => ({ feature, open: usedBy.length > 0, usedBy }))
    );
  });

  it("delegates payment to Stripe's frame only while Stripe's elements are in use", () => {
    const policy = directives(policies['next.config.js']);
    const used = featuresUsed();
    expect(used.payment).toEqual(expect.arrayContaining(['components/payments/PaymentIntentForm.tsx']));
    expect(policy.payment.includes(STRIPE_FRAME)).toBe(used.payment.length > 0);
    expect(policy.payment).toEqual(['self', STRIPE_FRAME]);
  });

  it('no longer carries interest-cohort, which no current browser recognises', () => {
    expect(directives(policies['next.config.js'])).not.toHaveProperty('interest-cohort');
  });
});
