import { describe, it, expect } from '@jest/globals';
import {
  estimateIndividualTax,
  helpRepaymentOn,
  incomeTaxOn,
  individualTaxOn,
  litoOn,
  medicareLevyOn,
  planDeductions,
  planQuarterlySetAside,
  planSuperContributions,
} from '../tax-plan.service';
import {
  assessRentAffordability,
  calculateMortgage,
  calculateStampDuty,
  compareRentVsBuy,
  estimateBorrowingPower,
  planDeposit,
} from '../housing-plan.service';
import { compareStructures, modelRaise, projectRunway, rankGrants, scoreGrant, valueBusiness } from '../business-plan.service';
import { assessNetWorth, assessRiskProfile, planEmergencyFund, projectWealth } from '../investment-plan.service';

describe('the individual tax scale', () => {
  it('matches the published 2025-26 brackets', () => {
    expect(incomeTaxOn(18200)).toBe(0);
    expect(incomeTaxOn(45000)).toBe(4288);
    expect(incomeTaxOn(100000)).toBe(20788);
    expect(incomeTaxOn(200000)).toBe(56138);
  });

  it('applies the low income offset and Medicare levy', () => {
    expect(litoOn(30000)).toBe(700);
    expect(litoOn(45000)).toBe(325);
    expect(litoOn(66667)).toBe(0);
    expect(medicareLevyOn(27000)).toBe(0);
    expect(Math.round(medicareLevyOn(100000))).toBe(2000);
    expect(Math.round(individualTaxOn(45000))).toBe(4863);
  });

  it('works HELP out on the marginal system from July 2025', () => {
    expect(helpRepaymentOn(60000)).toBe(0);
    expect(helpRepaymentOn(80000)).toBe(1950);
    expect(helpRepaymentOn(135000)).toBe(8700 + 1700);
  });

  it('estimates take-home pay with salary sacrifice counted for HELP', () => {
    const r = estimateIndividualTax({ grossIncome: 100000, salarySacrifice: 10000, hasHelpDebt: true });
    expect(r.taxableIncome).toBe(90000);
    expect(r.helpRepayment).toBe(Math.round(helpRepaymentOn(100000)));
    expect(r.netIncome).toBe(90000 - r.totalTax);
    expect(r.marginalRate).toBe(0.3);
    expect(r.employerSuper).toBe(12000);
  });
});

describe('deductions and super', () => {
  it('values the deductions at the marginal rate and caps the car claim', () => {
    const r = planDeductions({ taxableIncome: 90000, homeOfficeHoursPerWeek: 10, weeksWorkedFromHome: 40, carWorkKm: 8000, donations: 500 });
    const car = r.items.find((i) => i.key === 'car')!;
    expect(car.amount).toBe(4400);
    expect(r.items.find((i) => i.key === 'home_office')!.amount).toBe(280);
    expect(r.totalDeductions).toBe(5180);
    expect(r.taxSaved).toBe(Math.round(5180 * 0.32));
  });

  it('finds the concessional headroom and the co-contribution', () => {
    const r = planSuperContributions({ income: 60000, superBalance: 80000, personalAfterTax: 1000 });
    expect(r.employerContributions).toBe(7200);
    expect(r.concessionalHeadroom).toBe(22800);
    expect(r.coContribution).toBeGreaterThan(0);
    expect(r.coContribution).toBeLessThanOrEqual(500);
    expect(r.carryForwardEligible).toBe(true);
    expect(r.moves[0].key).toBe('fill_cap');
  });

  it('charges Division 293 above $250,000 and flags an over-cap contribution', () => {
    const r = planSuperContributions({ income: 260000, salarySacrifice: 5000 });
    expect(r.division293Tax).toBeGreaterThan(0);
    expect(r.overCapBy).toBeGreaterThan(0);
  });

  it('tells a sole trader what to put aside each quarter', () => {
    const r = planQuarterlySetAside({ businessProfit: 80000, businessSales: 120000, businessExpenses: 40000 });
    expect(r.mustRegisterForGst).toBe(true);
    expect(r.gstNetAnnual).toBe(Math.round(80000 / 11));
    expect(r.quarterlyTotal).toBe(r.quarterlyIncomeTax + r.quarterlyGst);
    expect(r.setAsidePctOfProfit).toBeGreaterThan(15);
  });
});

describe('housing', () => {
  it('calculates transfer duty from each state schedule', () => {
    expect(calculateStampDuty({ state: 'NSW', price: 800000 }).dutyPayable).toBe(30412);
    expect(calculateStampDuty({ state: 'QLD', price: 600000 }).dutyPayable).toBe(20025);
    expect(calculateStampDuty({ state: 'VIC', price: 1200000 }).dutyPayable).toBe(66000);
    expect(calculateStampDuty({ state: 'NT', price: 400000 }).dutyPayable).toBe(Math.round(0.06571441 * 160000 + 6000));
  });

  it('applies first home relief as an exemption then a sliding concession', () => {
    expect(calculateStampDuty({ state: 'NSW', price: 800000, firstHome: true })).toMatchObject({ dutyPayable: 0, reliefApplied: 'exempt' });
    const half = calculateStampDuty({ state: 'NSW', price: 900000, firstHome: true });
    expect(half.reliefApplied).toBe('concession');
    expect(half.dutyPayable).toBe(Math.round(34912 / 2));
    expect(calculateStampDuty({ state: 'QLD', price: 900000, firstHome: true, newHome: true }).dutyPayable).toBe(0);
    expect(calculateStampDuty({ state: 'SA', price: 600000, firstHome: true }).reliefApplied).toBe('none');
  });

  it('works a principal and interest repayment and the buffered one', () => {
    const r = calculateMortgage({ principal: 500000, annualRatePct: 6, years: 30 });
    expect(r.repayment).toBe(2997.75);
    expect(r.bufferedRepayment).toBeGreaterThan(r.repayment);
    const extra = calculateMortgage({ principal: 500000, annualRatePct: 6, years: 30, extraRepayment: 500 });
    expect(extra.withExtra!.yearsToRepay).toBeLessThan(25);
    expect(extra.withExtra!.interestSaved).toBeGreaterThan(100000);
  });

  it('plans a deposit under the Home Guarantee Scheme without LMI', () => {
    const r = planDeposit({ state: 'QLD', price: 700000, firstHome: true, currentSavings: 20000, monthlySaving: 1500 });
    expect(r.homeGuarantee.eligible).toBe(true);
    expect(r.depositPct).toBe(5);
    expect(r.lmiEstimate).toBe(0);
    expect(r.stampDuty.dutyPayable).toBe(0);
    expect(r.cashNeeded).toBe(35000 + r.otherCosts);
    expect(r.monthsToTarget).not.toBeNull();
    expect(r.scenarios.map((s) => s.depositPct)).toEqual([5, 10, 20]);
  });

  it('charges LMI when the price is over the cap and the deposit under 20%', () => {
    const r = planDeposit({ state: 'QLD', price: 1200000, firstHome: true, targetDepositPct: 10 });
    expect(r.homeGuarantee.eligible).toBe(false);
    expect(r.lmiEstimate).toBeGreaterThan(0);
  });

  it('reads rent against the 30% line', () => {
    const r = assessRentAffordability({ annualIncome: 70000, weeklyRent: 500 });
    expect(r.comfortableWeeklyRent).toBe(404);
    expect(r.inRentalStress).toBe(true);
    expect(assessRentAffordability({ annualIncome: 70000, weeklyRent: 350 }).inRentalStress).toBe(false);
  });

  it('estimates borrowing power at a buffered rate', () => {
    const r = estimateBorrowingPower({ annualIncome: 95000, annualRatePct: 6 });
    expect(r.assessmentRatePct).toBe(9);
    expect(r.estimatedBorrowingPower).toBeGreaterThan(200000);
    expect(r.estimatedBorrowingPower % 1000).toBe(0);
  });

  it('compares renting and buying over the years', () => {
    const r = compareRentVsBuy({ state: 'VIC', price: 650000, weeklyRent: 550, years: 10 });
    expect(r.series).toHaveLength(10);
    expect(['buying', 'renting']).toContain(r.ahead);
    expect(r.buying.equity).toBe(r.buying.endValue - r.buying.loanRemaining);
  });
});

describe('business', () => {
  it('taxes the four structures on the same profit and picks by priority', () => {
    const plain = compareStructures({ profit: 200000, hasCoFounders: true, beneficiaries: 2 });
    const sole = plain.options.find((o) => o.type === 'SOLE_TRADER')!;
    const company = plain.options.find((o) => o.type === 'COMPANY')!;
    const trust = plain.options.find((o) => o.type === 'TRUST')!;
    expect(sole.taxOnProfit).toBe(60138);
    expect(company.taxOnProfit).toBeLessThan(sole.taxOnProfit);
    expect(trust.taxOnProfit).toBeLessThan(sole.taxOnProfit);
    expect(plain.options.find((o) => o.type === 'PARTNERSHIP')!.available).toBe(true);
    const solo = compareStructures({ profit: 200000 });
    expect(solo.options.find((o) => o.type === 'PARTNERSHIP')!.available).toBe(false);
    expect(solo.options.find((o) => o.type === 'TRUST')!.taxOnProfit).toBe(sole.taxOnProfit);
    expect(solo.recommended).toBe('COMPANY');

    const protective = compareStructures({ profit: 200000, priorities: { assetProtection: true, raisingCapital: true } });
    expect(protective.recommended).toBe('COMPANY');
    expect(compareStructures({ profit: 30000, priorities: { simplicity: true } }).recommended).toBe('SOLE_TRADER');
  });

  it('values a business three ways and names the drivers', () => {
    const r = valueBusiness({ annualRevenue: 400000, annualProfit: 120000, industry: 'professional', growthPct: 20, recurringRevenuePct: 80, ownerDependence: 'low' });
    expect(r.range.low).toBeLessThanOrEqual(r.range.mid);
    expect(r.range.mid).toBeLessThanOrEqual(r.range.high);
    expect(r.drivers.map((d) => d.label)).toEqual(expect.arrayContaining(['Steady growth', 'Recurring revenue', 'Runs without you']));
    expect(r.methods.earningsMultiple.low).toBeGreaterThan(0);
    expect(valueBusiness({ annualRevenue: 100000, annualProfit: -10000 }).methods.earningsMultiple.high).toBe(0);
  });

  it('shows what a raise costs in ownership', () => {
    const r = modelRaise({ preMoney: 2000000, raiseAmount: 500000, optionPoolPct: 10, existingShares: 1000000 });
    expect(r.postMoney).toBe(2500000);
    expect(r.investorPct).toBe(20);
    expect(r.founderPctAfter).toBe(72);
    expect(r.pricePerShare).toBe(1.8);
    expect(r.ifValuationLower.founderPctAfter).toBeLessThan(r.founderPctAfter);
  });

  it('finds the month the cash runs out, or when revenue catches up', () => {
    const out = projectRunway({ cashOnHand: 50000, monthlyRevenue: 5000, monthlyExpenses: 15000 });
    expect(out.runwayMonths).toBe(5);
    expect(out.breakEvenMonth).toBeNull();
    const growing = projectRunway({ cashOnHand: 80000, monthlyRevenue: 8000, monthlyExpenses: 12000, revenueGrowthPct: 15 });
    expect(growing.breakEvenMonth).not.toBeNull();
    expect(growing.runwayMonths).toBeNull();
  });

  it('scores a grant against a profile and ranks the list', () => {
    const now = new Date('2026-09-10T00:00:00Z');
    const fit = { id: 'a', name: 'Female Founders Fund', stages: ['EARLY'], industries: ['Technology'], regions: ['QLD', 'NSW'], minFunding: 10000, maxFunding: 100000, deadline: new Date('2026-12-01'), tags: ['women', 'founders'] };
    const wrong = { id: 'b', name: 'Mining Export Grant', stages: ['GROWTH'], industries: ['Mining'], regions: ['WA'], minFunding: 500000, maxFunding: 2000000, isRolling: true, tags: [] };
    const closed = { id: 'c', name: 'Closed', stages: [], industries: [], regions: [], deadline: new Date('2026-01-01'), tags: [] };
    const profile = { stage: 'EARLY', industry: 'Technology', state: 'QLD', amountNeeded: 50000, womenLed: true };

    const a = scoreGrant(fit, profile, now);
    expect(a.score).toBe(100);
    expect(a.reasons).toContain('Made for women-led businesses');
    const b = scoreGrant(wrong, profile, now);
    expect(b.score).toBeLessThan(30);
    expect(b.gaps.length).toBeGreaterThanOrEqual(3);
    expect(scoreGrant(closed, profile, now).gaps).toContain('Applications have closed');
    expect(rankGrants([wrong, fit], profile, now).map((g) => g.id)).toEqual(['a', 'b']);
  });
});

describe('investing', () => {
  it('turns the questionnaire into a profile and caps it by horizon', () => {
    const bold = assessRiskProfile({ answers: { horizon: 4, drop: 4, experience: 4, income: 4, goal: 4, access: 4 } });
    expect(bold.profile).toBe('high_growth');
    expect(bold.allocation.reduce((s, a) => s + a.pct, 0)).toBe(100);
    const soon = assessRiskProfile({ answers: { horizon: 1, drop: 4, experience: 4, income: 4, goal: 4, access: 4 } });
    expect(soon.profile).toBe('cautious');
    expect(soon.cappedBy).toMatch(/three years/);
    expect(assessRiskProfile({ answers: {} }).profile).toBe('cautious');
  });

  it('adds up net worth and says what to move', () => {
    const r = assessNetWorth({
      holdings: [
        { name: 'Savings', kind: 'ASSET', category: 'CASH', value: 40000 },
        { name: 'ETF', kind: 'ASSET', category: 'INTL_SHARES', value: 10000 },
        { name: 'Card', kind: 'LIABILITY', category: 'CREDIT_CARD', value: 3000 },
        { name: 'Coins', kind: 'ASSET', category: 'CRYPTO', value: 20000 },
      ],
      superBalance: 60000,
      profile: 'growth',
      emergencyFundTarget: 15000,
    });
    expect(r.totalAssets).toBe(130000);
    expect(r.netWorth).toBe(127000);
    expect(r.investable).toBe(35000);
    expect(r.suggestions[0]).toMatch(/from cash toward/i);
    expect(r.warnings.some((w) => /crypto/i.test(w))).toBe(true);
    expect(r.warnings.some((w) => /card/i.test(w))).toBe(true);
  });

  it('projects three scenarios and prices the career break', () => {
    const r = projectWealth({ currentInvestments: 10000, currentSuper: 50000, monthlyContribution: 500, salary: 80000, years: 10, returnPct: 6 });
    expect(r.scenarios.map((s) => s.key)).toEqual(['base', 'boosted', 'careerBreak']);
    const [base, boosted, brk] = r.scenarios;
    expect(base.series).toHaveLength(10);
    expect(boosted.endTotal).toBeGreaterThan(base.endTotal);
    expect(brk.endTotal).toBeLessThan(base.endTotal);
    expect(base.endRealTotal).toBeLessThan(base.endTotal);
    expect(base.milestones.find((m) => m.amount === 100000)!.year).not.toBeNull();
    const flat = projectWealth({ monthlyContribution: 100, years: 1, returnPct: 0, inflationPct: 0 });
    expect(flat.scenarios[0].endTotal).toBe(1200);
  });

  it('sizes an emergency fund by income stability', () => {
    const r = planEmergencyFund({ monthlyExpenses: 4000, incomeStability: 'variable', currentSavings: 6000, monthlySaving: 1000 });
    expect(r.monthsRecommended).toBe(6);
    expect(r.target).toBe(24000);
    expect(r.gap).toBe(18000);
    expect(r.monthsToTarget).toBe(18);
    expect(r.milestones.filter((m) => m.reached).map((m) => m.pct)).toEqual([25]);
  });
});
