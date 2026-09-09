import { describe, it, expect } from '@jest/globals';
import { assessInvestmentProperty, compareLoans } from '../property-finance.service';
import { estimateRentAssistance, BOND_HELP } from '../rent-assistance.service';
import { checkPitch, rankInvestors, scoreInvestor } from '../investor-match.service';
import { planHelpDebt } from '../help-debt.service';
import { classifyLine, scanForDeductions } from '../deduction-finder.service';
import { planDebtPayoff } from '../debt-payoff.service';
import { assessInsuranceNeeds, planGoal, projectSuper, reviewHoldings, roundUpPotential } from '../wealth-tools.service';
import { findReminderCandidates, reminderMessage } from '../grant-reminders.service';

describe('loans and property', () => {
  it('ranks loans by what they cost over the years you keep them, fees included', () => {
    const r = compareLoans({ principal: 500000, years: 30, horizonYears: 5, offsetBalance: 20000, loans: [
      { name: 'Basic', ratePct: 6.1 },
      { name: 'Package', ratePct: 5.95, annualFee: 395, upfrontFee: 600, offset: true },
      { name: 'Fixed 2y', ratePct: 5.6, fixedYears: 2, revertRatePct: 6.9 },
    ] });
    expect(r.loans).toHaveLength(3);
    expect(r.loans.filter((l) => l.cheapest)).toHaveLength(1);
    const pkg = r.loans.find((l) => l.name === 'Package')!;
    expect(pkg.offsetSaving).toBeGreaterThan(0);
    expect(pkg.feesOverHorizon).toBe(600 + 395 * 5);
    const fixed = r.loans.find((l) => l.name === 'Fixed 2y')!;
    expect(fixed.repaymentAfterFixed).toBeGreaterThan(fixed.repayment);
    expect(r.loans.every((l) => l.moreThanCheapest >= 0)).toBe(true);
  });

  it('sums the yield and the after-tax cost of an investment property', () => {
    const r = assessInvestmentProperty({ state: 'QLD', price: 600000, weeklyRent: 550, taxableIncome: 110000, depositPct: 20 });
    expect(r.grossYieldPct).toBe(4.77);
    expect(r.purchaseCosts.stampDuty).toBe(20025);
    expect(r.cashFlowBeforeTax).toBeLessThan(0);
    expect(r.taxEffect).toBeGreaterThan(0);
    expect(r.cashFlowAfterTax).toBeGreaterThan(r.cashFlowBeforeTax);
    expect(r.projection).toHaveLength(10);
    expect(r.breakEvenWeeklyRent).toBeGreaterThan(550);
  });
});

describe('help with rent', () => {
  it('estimates rent assistance on the published formula', () => {
    const r = estimateRentAssistance({ fortnightlyRent: 400, household: 'single' });
    expect(r.estimateFortnightly).toBe(186.3);
    expect(estimateRentAssistance({ fortnightlyRent: 800, household: 'single' }).estimateFortnightly).toBe(211.2);
    expect(estimateRentAssistance({ fortnightlyRent: 100, household: 'couple' }).estimateFortnightly).toBe(0);
    expect(Object.keys(BOND_HELP)).toHaveLength(8);
  });
});

describe('investors and the pitch', () => {
  const profile = { stage: 'Seed', industry: 'Health', state: 'QLD', raiseAmount: 500000 };

  it('scores an investor the way it scores a grant', () => {
    const fit = scoreInvestor({ id: 'a', name: 'Fit', type: 'ANGEL', stages: ['Seed'], industries: ['Health'], regions: ['National'], minCheckSize: 50000, maxCheckSize: 500000, isVerified: true }, profile);
    expect(fit.score).toBeGreaterThanOrEqual(90);
    const wrong = scoreInvestor({ id: 'b', name: 'Wrong', type: 'VC', stages: ['Series B'], industries: ['Mining'], regions: ['WA'], minCheckSize: 5000000, maxCheckSize: 20000000 }, profile);
    expect(wrong.score).toBeLessThan(30);
    expect(wrong.gaps.length).toBeGreaterThanOrEqual(3);
    expect(rankInvestors([{ id: 'b', name: 'Wrong', type: 'VC' }, { id: 'a', name: 'Fit', type: 'ANGEL', stages: ['Seed'], industries: ['Health'] }], profile)[0].id).toBe('a');
  });

  it('reads what a pitch covers and says what is missing', () => {
    const thin = checkPitch({ text: 'We are building an app for busy mums. It is going to disrupt the market.' });
    expect(thin.score).toBeLessThan(40);
    expect(thin.missing.map((m) => m.key)).toContain('traction');
    expect(thin.tips.some((t) => /disruption/i.test(t))).toBe(true);

    const full = checkPitch({ sections: {
      problem: 'Two million Australian women lose an average of $30,000 in super over a career break and nobody tells them until it is too late.',
      solution: 'Our platform works out the catch-up amount and moves it automatically each payday.',
      market: 'There are 1.2 million women returning to work each year; a 2% take-up is 24,000 subscribers.',
      model: 'We charge $9 a month, 80% gross margin, LTV of $380 against a $60 CAC.',
      traction: '1,400 paying customers, revenue growing 18% month on month, 92% retention.',
      competition: 'Super funds show a balance; unlike them we act on it, and the payroll integrations take a year to copy.',
      team: 'I ran product at a super fund for six years; my co-founder built payroll integrations at Xero.',
      ask: 'We are raising $600,000 on a $3,000,000 pre-money SAFE.',
      useOfFunds: 'Two engineers and a payroll partnership manager, 18 months of runway to 10,000 subscribers.',
      whyNow: 'Payday super from July 2026 means every employer is rebuilding its payroll flow this year.',
    } });
    expect(full.score).toBe(100);
    expect(full.missing).toHaveLength(0);
    expect(full.grade).toBe('Ready to send');
  });
});

describe('the HELP debt', () => {
  it('clears sooner with a lump sum and says whether investing would beat it', () => {
    const r = planHelpDebt({ balance: 30000, income: 85000, lumpSum: 10000, extraMonthly: 200 });
    const [base, lump, extra] = r.scenarios;
    expect(base.yearsToRepay).not.toBeNull();
    expect(lump.yearsToRepay!).toBeLessThanOrEqual(base.yearsToRepay!);
    expect(extra.totalIndexation).toBeLessThan(base.totalIndexation);
    expect(r.lumpSumComparison!.investedInstead).toBeGreaterThan(r.lumpSumComparison!.indexationSaved);
    expect(r.compulsoryThisYear).toBe(2700);
  });
});

describe('deductions in the bank feed', () => {
  it('sorts spending into the deduction categories with a likelihood', () => {
    expect(classifyLine({ description: 'NSW NURSES ASSOCIATION MEMBERSHIP', amountCents: -68000 })).toMatchObject({ key: 'professional_fees', likelihood: 'likely' });
    expect(classifyLine({ description: 'WOOLWORTHS 1234 BRISBANE', amountCents: -12345 })).toMatchObject({ key: 'none', likelihood: 'no' });
    expect(classifyLine({ description: 'SALARY ACME PTY LTD', amountCents: 350000 }).category).toBe('Money in');
    const scan = scanForDeductions([
      { id: '1', description: 'OFFICEWORKS CHERMSIDE', amountCents: -24900 },
      { id: '2', description: 'TELSTRA BILL', amountCents: -9900 },
      { id: '3', description: 'RED CROSS DONATION', amountCents: -5000 },
      { id: '4', description: 'NETFLIX', amountCents: -1699 },
    ]);
    expect(scan.lines).toHaveLength(3);
    expect(scan.suggestedInput).toMatchObject({ toolsAndEquipment: 249, phoneAndInternet: 99, donations: 50 });
    expect(scan.totals.find((t) => t.key === 'donations')!.likely).toBe(50);
  });
});

describe('paying debts off', () => {
  it('pays less interest by avalanche and prices a consolidation honestly', () => {
    const r = planDebtPayoff({ debts: [{ name: 'Card', balance: 8000, ratePct: 21 }, { name: 'Car', balance: 12000, ratePct: 9, minPayment: 300 }], extraMonthly: 400, method: 'snowball', consolidationRatePct: 12, consolidationYears: 5 });
    expect(r.chosen.method).toBe('snowball');
    expect(r.other.totalInterest).toBeLessThanOrEqual(r.chosen.totalInterest);
    expect(r.chosen.months).not.toBeNull();
    expect(r.chosen.order[0].name).toBe('Card');
    expect(r.consolidation).not.toBeNull();
    expect(r.consolidation!.months).toBe(60);
    expect(typeof r.consolidation!.verdict).toBe('string');
  });
});

describe('the smaller wealth tools', () => {
  it('breaks a goal into a monthly amount', () => {
    const r = planGoal({ target: 12000, current: 0, months: 12 });
    expect(r.monthlyNeeded).toBe(1000);
    expect(r.milestones.find((m) => m.pct === 50)!.month).toBe(6);
    expect(planGoal({ target: 12000, current: 6000, months: 12, ratePct: 5 }).monthlyNeeded).toBeLessThan(500);
  });

  it('adds up what round-ups would have saved', () => {
    const r = roundUpPotential([
      { description: 'Coffee', amountCents: -430, postedAt: '2026-09-01' },
      { description: 'Lunch', amountCents: -1500, postedAt: '2026-09-02' },
      { description: 'Salary', amountCents: 300000, postedAt: '2026-09-03' },
    ], 5, 30);
    expect(r.purchases).toBe(2);
    expect(r.total).toBe(0.7);
    expect(r.examples).toHaveLength(1);
  });

  it('sizes income protection at 70% and life cover from the household shortfall', () => {
    const r = assessInsuranceNeeds({ income: 90000, monthlyExpenses: 4500, debts: 400000, dependants: 2, superBalance: 80000, savings: 20000, emergencyFundMonths: 3 });
    expect(r.incomeProtection.monthlyBenefit).toBe(5250);
    expect(r.incomeProtection.waitingPeriodDays).toBe(90);
    expect(r.life.need).toBe(400000 + 54000 * 15 + 120000 + 15000 - 100000);
    expect(r.tpd.need).toBeGreaterThan(r.life.need);
  });

  it('carries super to retirement and prices the career break', () => {
    const r = projectSuper({ age: 32, balance: 60000, salary: 85000, careerBreakYears: 2, breakAtAge: 34, partTimeYears: 3 });
    const [base, brk, extra] = r.scenarios;
    expect(r.yearsToGo).toBe(35);
    expect(brk.endBalance).toBeLessThan(base.endBalance);
    expect(extra.endBalance).toBeGreaterThan(base.endBalance);
    expect(r.careerBreakCost).toBeGreaterThan(0);
    expect(r.catchUpMonthly).toBeGreaterThan(0);
    expect(base.series[0].age).toBe(32);
    expect(base.series[base.series.length - 1].age).toBe(67);
  });

  it('works gains and losses on holdings and finds a loss to harvest', () => {
    const now = new Date('2026-09-10');
    const r = reviewHoldings([
      { name: 'ETF', category: 'INTL_SHARES', value: 15000, costBase: 10000, acquiredAt: '2024-01-15' },
      { name: 'Miner', category: 'AU_SHARES', value: 3000, costBase: 5000, acquiredAt: '2026-03-01' },
      { name: 'Cash', category: 'CASH', value: 8000 },
    ], 100000, now);
    const etf = r.holdings.find((h) => h.name === 'ETF')!;
    expect(etf.gain).toBe(5000);
    expect(etf.discountEligible).toBe(true);
    expect(etf.taxIfSold).toBe(Math.round(2500 * 0.32));
    expect(r.holdings.find((h) => h.name === 'Cash')!.gain).toBeNull();
    expect(r.unrealisedLosses).toBe(-2000);
    expect(r.harvest).toHaveLength(1);
    expect(r.taxIfAllSold).toBe(Math.round((2500 - 2000) * 0.32));
  });
});

describe('grant deadline reminders', () => {
  it('finds drafts inside the week and day windows and words the nudge', () => {
    const now = new Date('2026-09-10T00:00:00Z');
    const apps = [
      { id: 'a', userId: 'u1', status: 'DRAFT', grant: { id: 'g1', name: 'Boost', deadline: new Date('2026-09-15T00:00:00Z') } },
      { id: 'b', userId: 'u1', status: 'DRAFT', grant: { id: 'g2', name: 'Soon', deadline: new Date('2026-09-11T00:00:00Z') } },
      { id: 'c', userId: 'u2', status: 'SUBMITTED', grant: { id: 'g1', name: 'Boost', deadline: new Date('2026-09-15T00:00:00Z') } },
      { id: 'd', userId: 'u3', status: 'DRAFT', grant: { id: 'g3', name: 'Later', deadline: new Date('2026-10-30T00:00:00Z') } },
      { id: 'e', userId: 'u3', status: 'DRAFT', grant: { id: 'g4', name: 'Gone', deadline: new Date('2026-09-01T00:00:00Z') } },
    ];
    const found = findReminderCandidates(apps, now);
    expect(found.map((f) => `${f.applicationId}:${f.window}`)).toEqual(['a:week', 'b:day']);
    expect(reminderMessage(found[1]).title).toBe('Grant closes tomorrow');
    expect(reminderMessage(found[0]).message).toMatch(/in 5 days/);
  });
});
