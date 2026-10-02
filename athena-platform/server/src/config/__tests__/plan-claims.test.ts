import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { freeChatAllowance, paidChatAllowance } from '../../services/entitlements.service';
import { CREATOR_TIERS } from '../../services/creator.service';

/**
 * What the pricing page promises is what the server does.
 *
 * The page promised "5 job applications/month" on Free and "Unlimited" on Pro,
 * 20% off courses, a free mentor session a month, ten interview-coach sessions a
 * month, SSO/SAML and API access. None of it existed on the server: no route
 * capped applications, and a member would have paid for benefits she could not
 * receive. The page now lists only the six AI tools and the bigger chat
 * allowance, and this test is what keeps it that way. A feature string cannot be
 * added to the Free or Pro card without being named here, next to the thing on
 * the server that makes it true; and the server side is checked, not assumed:
 * each tool has to be a route that is refused without an active Pro or trial.
 *
 * It reads the web app's page as text, because the web app cannot be imported
 * from this package, the same way price-book.test.ts reads the client's copy of
 * the figures. The phone's membership screen is read the same way: its cards
 * each carried a sentence of their own ("priority applications", "mentoring
 * credits", "a lower platform fee") that nothing on the server did. The creator
 * tiers are this package's own and are imported.
 */

const PRICING_PAGE = path.resolve(__dirname, '../../../../client/src/app/pricing/page.tsx');
const BILLING_PAGE = path.resolve(__dirname, '../../../../client/src/app/dashboard/settings/billing/page.tsx');
const MOBILE_UPGRADE_SCREEN = path.resolve(__dirname, '../../../../mobile/src/screens/UpgradeScreen.tsx');
const AI_ROUTES = path.resolve(__dirname, '../../routes/ai.routes.ts');

/** Each Pro tool, and the route that is refused to a member without Pro. */
const PRO_TOOLS: Record<string, { method: 'get' | 'post'; path: string }[]> = {
  'AI Resume Optimizer': [{ method: 'post', path: '/resume-optimizer' }],
  'Interview Coach': [
    { method: 'post', path: '/interview-coach' },
    { method: 'post', path: '/interview-coach/feedback' },
  ],
  'Opportunity Radar AI': [
    { method: 'get', path: '/opportunity-radar' },
    { method: 'post', path: '/opportunity-radar' },
  ],
  'Career Path Planner': [
    { method: 'get', path: '/career-path' },
    { method: 'post', path: '/career-path' },
  ],
  'AI Content Generator': [{ method: 'post', path: '/content-generator' }],
  'Business Idea Validator': [{ method: 'post', path: '/idea-validator' }],
};

const CHAT_FREE = 'ATHENA AI chat, with a daily allowance';
const CHAT_PRO = 'A larger daily allowance for the ATHENA AI chat';

/** What every member has: nothing here is gated, capped or promised beyond existing. */
const FREE_BASICS = ['Job search and applications', 'Community access', 'Your profile'];

const read = (file: string) => fs.readFileSync(file, 'utf8');

/** The `{ name, included }` rows of one plan on the pricing page. */
function featuresOf(source: string, planId: 'free' | 'pro' | 'enterprise'): { name: string; included: boolean }[] {
  const start = source.indexOf(`id: '${planId}'`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf(`id: '`, start + 10);
  const block = source.slice(start, next === -1 ? undefined : next);
  // A chat row also says which allowance it prints (`chat: 'free' as const`);
  // the figure itself comes from the server's table when the page renders.
  const rows = [...block.matchAll(/\{ name: '([^']+)', included: (true|false)(?:, chat: '(?:free|paid)' as const)? \}/g)];
  // Fail closed. A row written another way (double quotes, a property this
  // pattern does not know) would otherwise be invisible to every assertion
  // below, and an unenforced promise could be added to a card without this
  // test noticing. Every feature row in the block has to be one it can read.
  const declared = block.match(/\{\s*name:/g)?.length ?? 0;
  expect(rows.length).toBe(declared);
  return rows.map((m) => ({
    name: m[1],
    included: m[2] === 'true',
  }));
}

/** The plain strings of a feature list on the billing page. */
function billingList(source: string, name: 'FREE_FEATURES' | 'PRO_FEATURES'): string[] {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  expect(match).not.toBeNull();
  return [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('The tools the pricing page says Pro unlocks', () => {
  const ai = read(AI_ROUTES);

  it.each(Object.entries(PRO_TOOLS))('%s is refused to a member without an active Pro or trial', (_tool, routes) => {
    for (const route of routes) {
      const declaration = new RegExp(`router\\.${route.method}\\('${route.path}',\\s*authenticate,\\s*requireAiPremium`);
      expect(ai).toMatch(declaration);
    }
  });

  it('gives Pro a larger chat allowance than Free, which is what the page says', () => {
    // The allowances live in entitlements.service, the one table the pages print
    // from; the router has to read its quota from there, not keep constants of
    // its own, or the page and the gate could say two different numbers.
    expect(ai).toMatch(/import \{[^}]*\bchatAllowanceFor\b[^}]*\} from '\.\.\/services\/entitlements\.service'/);
    expect(paidChatAllowance().messages).toBeGreaterThan(freeChatAllowance().messages);
  });
});

describe('What the pricing page lists', () => {
  const page = read(PRICING_PAGE);
  const tools = Object.keys(PRO_TOOLS);

  it('lists on Pro only the tools above, what Free has, and the larger chat allowance', () => {
    const pro = featuresOf(page, 'pro');

    expect(pro.every((f) => f.included)).toBe(true);
    const unknown = pro.map((f) => f.name).filter((n) => n !== 'Everything in Free' && n !== CHAT_PRO && !tools.includes(n));
    // A new line here has to be a thing the server does: add it to PRO_TOOLS, with the route that gates it.
    expect(unknown).toEqual([]);
    for (const tool of tools) expect(pro.map((f) => f.name)).toContain(tool);
    expect(pro.map((f) => f.name)).toContain(CHAT_PRO);
  });

  it('lists on Free the basics and the chat, and shows the tools as what Pro adds', () => {
    const free = featuresOf(page, 'free');

    const included = free.filter((f) => f.included).map((f) => f.name);
    expect(included.sort()).toEqual([...FREE_BASICS, CHAT_FREE].sort());
    const excluded = free.filter((f) => !f.included).map((f) => f.name);
    expect(excluded.sort()).toEqual([...tools].sort());
  });

  it('puts no checklist on Enterprise: what an organisation gets is agreed with it', () => {
    expect(featuresOf(page, 'enterprise')).toEqual([]);
  });

  it('puts no number of applications, sessions or percentage off on any card', () => {
    const cards = ['free', 'pro', 'enterprise'].flatMap((id) => featuresOf(page, id as 'free'));
    for (const feature of cards) {
      expect(feature.name).not.toMatch(/\d/);
    }
  });
});

describe('What the billing page lists', () => {
  const billing = read(BILLING_PAGE);

  it('lists the same things as the pricing page, and nothing more', () => {
    expect(billingList(billing, 'FREE_FEATURES').sort()).toEqual([...FREE_BASICS.filter((f) => f !== 'Your profile'), CHAT_FREE].sort());
    expect(billingList(billing, 'PRO_FEATURES').sort()).toEqual([...Object.keys(PRO_TOOLS), CHAT_PRO].sort());
  });
});

describe('What the phone’s membership screen lists', () => {
  const screen = read(MOBILE_UPGRADE_SCREEN);

  it('says a paid tier adds the six tools and the larger chat allowance, the same as the web', () => {
    const match = screen.match(/const PAID_ADDS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const listed = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual([...Object.keys(PRO_TOOLS), CHAT_PRO].sort());
  });

  it('gives no tier a sentence of its own, because nothing on the server reads which paid tier a member is on', () => {
    const match = screen.match(/const TIERS[^=]*= \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const rows = match![1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    // A key and a name, nothing else: a tier that one day adds something gets
    // the thing built and gated first, then named in PAID_ADDS, not on a card.
    for (const row of rows) expect(row).toMatch(/^\{ key: '[A-Z_]+', name: '[A-Za-z ]+' \},?$/);
  });
});

describe('What the creator tiers promise', () => {
  it('is the share of each gift, and nothing the server does not do', () => {
    // GET /api/creator/tiers serves this list. It used to carry "Priority
    // support", "Featured placement", "Dedicated account manager" and "Brand
    // partnerships"; the share is the one thing the code reads from a tier.
    expect(CREATOR_TIERS.length).toBeGreaterThan(0);
    for (const tier of CREATOR_TIERS) {
      expect(tier.benefits).toEqual([`Keeps ${tier.revShare}% of the value of every gift received`]);
    }
  });
});
