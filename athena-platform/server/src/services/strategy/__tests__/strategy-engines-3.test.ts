import { describe, it, expect } from '@jest/globals';
import { generateFormationDocuments } from '../formation-documents.service';
import { launchChecklist, pickVendors } from '../launch-package.service';
import { buildDeckOutline } from '../deck-outline.service';
import { financialYear } from '../earnings-statement.service';
import { coversDueForReview, rebalanceNeeded } from '../wealth-nudges.service';
import { assessNetWorth, superOptionGrowthPct } from '../investment-plan.service';

describe('formation documents', () => {
  it('writes the company documents with the directors and the office in them', () => {
    const docs = generateFormationDocuments({ type: 'COMPANY', businessName: 'Bright Path Pty Ltd', acn: '123456789', data: { directors: [{ name: 'Ana Silva' }, 'Bea Ngata'], registeredAddress: { line1: '12 Wickham St', city: 'Brisbane', state: 'QLD', postcode: '4000', country: 'Australia' } } });
    expect(docs.map((d) => d.key)).toEqual(['getting-started', 'director-consents', 'first-resolution', 'constitution-note']);
    const consents = docs.find((d) => d.key === 'director-consents')!;
    expect(consents.content).toMatch(/I, Ana Silva/);
    expect(consents.content).toMatch(/I, Bea Ngata/);
    expect(consents.content).toMatch(/ACN 123456789/);
    const resolution = docs.find((d) => d.key === 'first-resolution')!;
    expect(resolution.content).toMatch(/12 Wickham St, Brisbane, QLD 4000, Australia/);
    expect(resolution.content).toMatch(/until a constitution is adopted/);
  });

  it('drafts a partnership agreement with equal shares and the governing state', () => {
    const docs = generateFormationDocuments({ type: 'PARTNERSHIP', businessName: 'Two Sisters Catering', data: { partners: ['Ana Silva', 'Bea Ngata'], registeredAddress: { state: 'VIC' } } });
    const agreement = docs.find((d) => d.key === 'partnership-agreement')!;
    expect(agreement.content).toMatch(/Ana Silva 50%, Bea Ngata 50%/);
    expect(agreement.content).toMatch(/governed by the law of VIC/);
    expect(agreement.content).toMatch(/\[amount\]/);
  });

  it('gives a trust the solicitor instructions rather than a deed, and a sole trader the two guides', () => {
    const trust = generateFormationDocuments({ type: 'TRUST', businessName: 'Silva Family Trust', data: { trustees: ['Ana Silva'] } });
    expect(trust.map((d) => d.key)).toEqual(['getting-started', 'trust-deed-instructions', 'trustee-resolution']);
    expect(trust[1].content).toMatch(/does not draw the deed/);
    const sole = generateFormationDocuments({ type: 'SOLE_TRADER', businessName: 'Ana Silva Design', data: {} });
    expect(sole.map((d) => d.key)).toEqual(['getting-started', 'record-keeping']);
    expect(sole[0].content).toMatch(/your own tax file number/i);
  });
});

describe('the launch package', () => {
  it('orders the launch by structure and adds the steps employing or leasing brings', () => {
    const company = launchChecklist('COMPANY', { employees: true, premises: true });
    const keys = company.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['structure', 'abn', 'asic', 'name', 'bank', 'books', 'gst', 'insurance', 'payroll', 'lease', 'brand', 'terms', 'launch']));
    expect(keys.indexOf('asic')).toBeLessThan(keys.indexOf('name'));
    const sole = launchChecklist('SOLE_TRADER', { online: false });
    expect(sole.map((s) => s.key)).not.toContain('asic');
    expect(sole.map((s) => s.key)).not.toContain('terms');
  });

  it('picks partners first, then the best rated, three to a category', () => {
    const vendors = [
      { id: 'a', name: 'A', category: 'LEGAL', avgRating: 4.9, isPartner: false, isVerified: true },
      { id: 'b', name: 'B', category: 'LEGAL', avgRating: 4.2, isPartner: true, discountPct: 20 },
      { id: 'c', name: 'C', category: 'LEGAL', avgRating: 3.5 },
      { id: 'd', name: 'D', category: 'LEGAL', avgRating: 4.0 },
      { id: 'e', name: 'E', category: 'ACCOUNTING_TAX', avgRating: 5 },
    ];
    const picks = pickVendors(vendors, ['LEGAL', 'ACCOUNTING_TAX', 'DESIGN_MARKETING']);
    expect(picks[0].picks.map((p) => p.id)).toEqual(['b', 'a', 'd']);
    expect(picks[0].picks[0].discountPct).toBe(20);
    expect(picks[1].picks).toHaveLength(1);
    expect(picks[2].picks).toHaveLength(0);
  });
});

describe('the deck outline', () => {
  it('lays the pitch out over twelve slides and marks what still needs writing', () => {
    const deck = buildDeckOutline({ businessName: 'Bright Path', sections: { problem: 'Two million women lose super over a career break. Nobody tells them.', ask: 'We are raising $600,000.' } });
    expect(deck.slides).toHaveLength(12);
    expect(deck.slides[0].title).toBe('Bright Path');
    expect(deck.slides.find((s) => s.title === 'The problem')!.fromPitch).toBe(true);
    expect(deck.slides.find((s) => s.title === 'What has happened so far')!.body).toMatch(/^\[/);
    expect(deck.markdown).toMatch(/## Slide 9: The raise\n\nWe are raising \$600,000\./);
  });
});

describe('the financial year and the nudges', () => {
  it('finds the Australian financial year from a date', () => {
    const fy = financialYear(undefined, new Date('2026-09-12T00:00:00Z'));
    expect(fy.label).toBe('FY2027');
    expect(fy.from.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(fy.to.toISOString().slice(0, 10)).toBe('2027-06-30');
    expect(financialYear(2025).from.toISOString().slice(0, 10)).toBe('2024-07-01');
  });

  it('finds the covers a year old and the mix that has drifted', () => {
    const now = new Date('2026-09-12T00:00:00Z');
    const due = coversDueForReview([
      { id: 'a', userId: 'u', status: 'ACTIVE', startDate: '2025-09-01', createdAt: '2025-08-01' },
      { id: 'b', userId: 'u', status: 'ACTIVE', startDate: '2026-03-01', createdAt: '2026-02-01' },
      { id: 'c', userId: 'u', status: 'DRAFT', createdAt: '2024-01-01' },
    ], now);
    expect(due.map((c) => c.id)).toEqual(['a']);
    expect(rebalanceNeeded([{ label: 'Cash', drift: 14, move: -7000 }, { label: 'International shares', drift: -12, move: 6000 }, { label: 'Bonds', drift: -2, move: 1000 }])).toMatchObject({ over: 'Cash', under: 'International shares', move: 6000 });
    expect(rebalanceNeeded([{ label: 'Cash', drift: 4, move: -1000 }, { label: 'Bonds', drift: -4, move: 1000 }])).toBeNull();
  });
});

describe('the whole of wealth', () => {
  it('reads the super option into a growth share and counts it with the holdings', () => {
    expect(superOptionGrowthPct('High Growth')).toBe(90);
    expect(superOptionGrowthPct('Conservative')).toBe(30);
    expect(superOptionGrowthPct(null)).toBe(60);
    const r = assessNetWorth({
      holdings: [{ name: 'Savings', kind: 'ASSET', category: 'CASH', value: 50000 }, { name: 'ETF', kind: 'ASSET', category: 'INTL_SHARES', value: 50000 }],
      superAccounts: [{ balance: 100000, investmentOpt: 'High Growth' }],
      profile: 'growth',
    });
    // 50k growth in holdings plus 90k growth in super over 200k in all.
    expect(r.wholeOfWealth.growthPct).toBe(70);
    expect(r.wholeOfWealth.superGrowthPct).toBe(90);
    expect(r.wholeOfWealth.targetGrowthPct).toBe(75);
    expect(r.incomeEstimate.annual).toBe(2250 + 1000);
    expect(r.incomeEstimate.byCategory.map((c) => c.category)).toEqual(['CASH', 'INTL_SHARES']);
  });
});
