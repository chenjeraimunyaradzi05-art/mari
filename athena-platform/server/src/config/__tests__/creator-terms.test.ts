import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The Creator Terms Addendum is one text with one version, and the server
 * records the version a creator accepted. The web app cannot import from this
 * package, so it holds a copy of the version for the page that shows the
 * addendum and the box she ticks. These hold that the two copies are the same,
 * that the text the version names exists and quotes the price book rather than
 * numbers of its own, and that the web app sends the acceptance and the version
 * instead of assuming them.
 */

import { CREATOR_TERMS_PATH, CREATOR_TERMS_VERSION } from '../creator-terms';

const clientSrc = path.resolve(__dirname, '..', '..', '..', '..', 'client', 'src');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function exportedString(source: string, name: string): string | null {
  const match = new RegExp(`export const ${name}\\s*=\\s*'([^']*)'`).exec(source);
  return match ? match[1] : null;
}

describe('the Creator Terms Addendum version', () => {
  it('is a date, so a creator and the team can both read when the text last changed', () => {
    expect(CREATOR_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(new Date(CREATOR_TERMS_VERSION).getTime())).toBe(false);
  });

  it('is held by the web app under the same version and path', () => {
    const copy = read(path.join(clientSrc, 'lib', 'creator-terms.ts'));
    expect(exportedString(copy, 'CREATOR_TERMS_VERSION')).toBe(CREATOR_TERMS_VERSION);
    expect(exportedString(copy, 'CREATOR_TERMS_PATH')).toBe(CREATOR_TERMS_PATH);
  });
});

describe('the text the version names', () => {
  const content = read(path.join(clientSrc, 'content', 'legal', 'creator-terms.md'));

  it('exists, is the addendum, and covers each condition Terms 5.1 lists', () => {
    expect(content).toMatch(/^# Creator Terms Addendum/m);
    expect(content).toMatch(/18 years old/);
    expect(content).toMatch(/good standing/);
    expect(content).toMatch(/Stripe/);
    expect(content).toMatch(/## 5\. Tax/);
  });

  it('quotes the price book through tokens and carries no percentage of its own', () => {
    expect(content).toMatch(/\{\{\s*price\.creatorShareRange\s*\}\}/);
    expect(content).toMatch(/\{\{\s*price\.platformFeeRange\s*\}\}/);
    expect(content).toMatch(/\{\{\s*price\.minimumPayout\s*\}\}/);
    expect(content).not.toMatch(/\d+%/);
    expect(content).not.toMatch(/\d+ days?\b.*payout/i);
  });

  it('is shown on a page that prints the version she is accepting, under the same path the server sends her to', () => {
    const pageDir = path.join(clientSrc, 'app', ...CREATOR_TERMS_PATH.split('/').filter(Boolean));
    const page = read(path.join(pageDir, 'page.tsx'));
    expect(page).toMatch(/CREATOR_TERMS_VERSION/);
    expect(page).toMatch(/creator-terms\.md/);
    expect(page).toMatch(/CreatorTermsAcceptance/);
  });
});

describe('what the web app sends', () => {
  it('carries the acceptance and the version when it turns on creator mode, and accepts by version', () => {
    const api = read(path.join(clientSrc, 'lib', 'api.ts'));
    // Turning creator mode on takes the acceptance as an argument: nothing is
    // sent that the member did not give.
    expect(api).toMatch(/enable: \(acceptance: \{ acceptCreatorTerms: true; termsVersion: string \}\) => api\.post\('\/creator\/enable', acceptance\)/);
    expect(api).toMatch(/api\.post\('\/creator\/terms\/accept', \{ version \}\)/);
    expect(api).not.toMatch(/api\.post\('\/creator\/enable'\)/);
  });

  it('is sent from the acceptance box, from the one copy of the version', () => {
    const box = read(path.join(clientSrc, 'app', 'creator-terms', 'CreatorTermsAcceptance.tsx'));
    expect(box).toMatch(/from '@\/lib\/creator-terms'/);
    expect(box).toMatch(/acceptCreatorTerms: true, termsVersion: CREATOR_TERMS_VERSION/);
    expect(box).toMatch(/acceptTerms\(CREATOR_TERMS_VERSION\)/);
  });
});
