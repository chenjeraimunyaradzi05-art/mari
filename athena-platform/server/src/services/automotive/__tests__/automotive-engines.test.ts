import { describe, it, expect } from '@jest/globals';
import { assessAffordability, assessReadiness, calculateRepayment, compareCarLoans, costOfOwnership, effectiveRate, monthlyPayment, netAnnualIncome, presentValue } from '../car-finance.service';
import { benchmarkPrice, estimateValue, projectValue, retainedShare, upgradePath } from '../valuation.service';
import { compareInsuranceQuotes, estimatePremium } from '../car-insurance.service';
import { dealerSaleFee, referralFee, summariseReferrals } from '../referrals.service';
import { assessListingRisk, inspectionEnds, inspectionOutcome, isValidVin, maskRego, maskVin, normaliseInspectionReport, purchaseFee, purchaseTransition, withinInspection } from '../marketplace.service';
import { bookingMinutes, markSent, nextServiceAfter, normaliseQuoteLines, priceFor, projectedOdometer, quoteTotal, recomputeCarRating, recomputeMechanicRating, shouldSend, vehicleReminders } from '../garage.service';
import { CAR_SEEDS, SAFETY_FEATURES, SERVICE_KINDS, ancapStatus, co2ForCar } from '../automotive-library';

describe('car finance', () => {
  it('works out a level repayment and its interest', () => {
    const r = calculateRepayment({ amount: 30000, ratePct: 8, termMonths: 60 });
    expect(r.repayment).toBeCloseTo(608.29, 1);
    expect(r.totalInterest).toBeGreaterThanOrEqual(6496);
    expect(r.totalInterest).toBeLessThanOrEqual(6499);
    expect(r.balloon).toBe(0);
    expect(r.schedule).toHaveLength(5);
    expect(r.schedule[4].closing).toBe(0);
    expect(r.effectiveRatePct).toBeCloseTo(8, 0);
  });

  it('a balloon lowers the repayment and leaves the lump owing', () => {
    const plain = calculateRepayment({ amount: 30000, ratePct: 8, termMonths: 60 });
    const balloon = calculateRepayment({ amount: 30000, ratePct: 8, termMonths: 60, balloonPct: 30 });
    expect(balloon.repayment).toBeLessThan(plain.repayment);
    expect(balloon.balloon).toBe(9000);
    expect(balloon.totalInterest).toBeGreaterThan(plain.totalInterest);
  });

  it('fees raise the effective rate the way a comparison rate does', () => {
    const r = calculateRepayment({ amount: 30000, ratePct: 7.5, termMonths: 60, establishmentFee: 400, monthlyFee: 10 });
    expect(r.effectiveRatePct).toBeGreaterThan(7.5);
    expect(r.totalFees).toBe(400 + 600);
    expect(effectiveRate(30000, monthlyPayment(30000, 0, 60), 60, 0)).toBe(0);
    expect(presentValue(monthlyPayment(20000, 9, 48), 9, 48)).toBeCloseTo(20000, 0);
  });

  it('ranks loans by their whole cost and says why', () => {
    const r = compareCarLoans({ amount: 30000, termMonths: 60, loans: [{ name: 'Bank', ratePct: 7.99, establishmentFee: 250 }, { name: 'Dealer', ratePct: 6.49, balloonPct: 40, monthlyFee: 8 }, { name: 'Unsecured', ratePct: 12.5, secured: false }] });
    expect(r.loans[0].cheapest).toBe(true);
    expect(r.loans.find((l) => l.name === 'Dealer')!.note).toContain('balloon');
    expect(r.loans.find((l) => l.name === 'Unsecured')!.note).toContain('unsecured');
    expect(r.loans.every((l) => l.moreThanCheapest >= 0)).toBe(true);
  });

  it('take-home pay follows the brackets and the levy', () => {
    expect(netAnnualIncome(0)).toBe(0);
    const net = netAnnualIncome(80000);
    expect(net).toBeGreaterThan(60000);
    expect(net).toBeLessThan(70000);
  });

  it('affordability draws a comfortable line and a stretch line', () => {
    const r = assessAffordability({ incomeAnnual: 85000, expensesMonthly: 2600, otherDebtsMonthly: 200, dependants: 1, deposit: 5000, termMonths: 60, ratePct: 9 });
    expect(r.comfortableRepayment).toBeGreaterThan(0);
    expect(r.maxRepayment).toBeGreaterThan(r.comfortableRepayment);
    expect(r.maxLoan).toBeGreaterThan(r.comfortableLoan);
    expect(r.comfortablePrice).toBe(r.comfortableLoan + 5000);
    expect(r.testedRatePct).toBe(11);
    expect(r.verdict).toBe('comfortable');
    const tight = assessAffordability({ incomeAnnual: 32000, expensesMonthly: 2300, termMonths: 60 });
    expect(tight.verdict).toBe('not_yet');
  });

  it('costs a petrol car and an electric car over five years', () => {
    const petrol = costOfOwnership({ price: 35000, fuelType: 'PETROL', bodyType: 'SUV', fuelPer100: 7.5, years: 5, state: 'QLD', servicingYear: 450 });
    const ev = costOfOwnership({ price: 45000, fuelType: 'ELECTRIC', bodyType: 'SUV', kwhPer100: 16, years: 5, state: 'QLD', servicingYear: 250 });
    expect(petrol.years).toHaveLength(5);
    expect(petrol.totals.energy).toBe(5 * Math.round(15000 * 7.5 / 100 * 1.9));
    expect(ev.totals.energy).toBeLessThan(petrol.totals.energy);
    expect(ev.totals.depreciation).toBeGreaterThan(petrol.totals.depreciation);
    expect(petrol.totals.perWeek).toBeGreaterThan(0);
    expect(petrol.assumptions.some((a) => a.includes('QLD'))).toBe(true);
    const financed = costOfOwnership({ price: 35000, fuelType: 'PETROL', years: 3, loan: { amount: 30000, ratePct: 8, termMonths: 60 } });
    expect(financed.totals.interest).toBeGreaterThan(0);
  });

  it('readiness rewards a deposit and steady work and warns about the rest', () => {
    const ready = assessReadiness({ vehiclePrice: 30000, deposit: 6000, incomeAnnual: 90000, expensesMonthly: 2500, employment: 'FULL_TIME', employmentMonths: 24, residency: 'CITIZEN' });
    expect(ready.band).toBe('ready');
    expect(ready.amount).toBe(24000);
    const shaky = assessReadiness({ vehiclePrice: 45000, incomeAnnual: 48000, expensesMonthly: 2400, employment: 'CASUAL', employmentMonths: 3, residency: 'VISA', hasDefaults: true });
    expect(shaky.band).toBe('not_yet');
    expect(shaky.notes.some((n) => n.includes('default'))).toBe(true);
    expect(shaky.lenderChecks.length).toBeGreaterThan(5);
  });
});

describe('valuation', () => {
  it('depreciates faster in the first year and slower for a ute than an electric car', () => {
    expect(retainedShare(0.5, 'SUV', 'PETROL')).toBeGreaterThan(0.9);
    expect(retainedShare(1, 'SUV', 'PETROL')).toBe(0.82);
    expect(retainedShare(5, 'UTE', 'DIESEL')).toBeGreaterThan(retainedShare(5, 'HATCH', 'ELECTRIC'));
    expect(retainedShare(40, 'SEDAN', 'PETROL')).toBe(0.08);
    const path = projectValue(40000, 'SUV', 'PETROL', 3);
    expect(path).toHaveLength(3);
    expect(path[0]).toBeGreaterThan(path[1]);
  });

  it('adjusts for kilometres, condition and make', () => {
    const now = new Date('2026-09-13T00:00:00Z');
    const base = estimateValue({ year: 2021, odometerKm: 75000, bodyType: 'SUV', fuelType: 'PETROL', newPrice: 40000, make: 'Toyota', now });
    const highKm = estimateValue({ year: 2021, odometerKm: 160000, bodyType: 'SUV', fuelType: 'PETROL', newPrice: 40000, make: 'Toyota', now });
    const poor = estimateValue({ year: 2021, odometerKm: 75000, bodyType: 'SUV', fuelType: 'PETROL', newPrice: 40000, make: 'Toyota', condition: 'POOR', now });
    const euro = estimateValue({ year: 2021, odometerKm: 75000, bodyType: 'SUV', fuelType: 'PETROL', newPrice: 40000, make: 'Audi', now });
    expect(base.low).toBeLessThan(base.mid);
    expect(base.high).toBeGreaterThan(base.mid);
    expect(base.tradeIn).toBeLessThan(base.privateSale);
    expect(highKm.mid).toBeLessThan(base.mid);
    expect(poor.mid).toBeLessThan(base.mid);
    expect(euro.mid).toBeLessThan(base.mid);
    expect(base.newPriceAssumed).toBe(false);
    const guessed = estimateValue({ year: 2018, odometerKm: 120000, bodyType: 'HATCH', now });
    expect(guessed.newPriceAssumed).toBe(true);
    expect(guessed.assumptions[0]).toContain('assumed');
  });

  it('benchmarks a price against the guide and plans an upgrade', () => {
    const v = estimateValue({ year: 2020, odometerKm: 90000, bodyType: 'SUV', fuelType: 'PETROL', newPrice: 40000, now: new Date('2026-09-13T00:00:00Z') });
    expect(benchmarkPrice(v.mid, v).verdict).toBe('FAIR');
    expect(benchmarkPrice(v.mid * 0.7, v).verdict).toBe('WELL_BELOW');
    expect(benchmarkPrice(v.mid * 1.12, v).verdict).toBe('ABOVE');
    const up = upgradePath({ current: v, targetPrice: 45000, loanBalance: 5000, savings: 10000, monthlySaving: 800 });
    expect(up.changeoverPrivate).toBe(45000 - v.privateSale + 5000);
    expect(up.changeoverTradeIn).toBeGreaterThan(up.changeoverPrivate);
    expect(up.negativeEquity).toBe(false);
    expect(up.monthsToSave).toBeGreaterThan(0);
    const under = upgradePath({ current: v, targetPrice: 45000, loanBalance: v.privateSale + 3000 });
    expect(under.negativeEquity).toBe(true);
  });
});

describe('insurance', () => {
  it('prices comprehensive from the value and moves it by the factors', () => {
    const base = estimatePremium({ vehicleValue: 30000, driverAge: 35, state: 'QLD', garaging: 'GARAGE', claimsFreeYears: 5 });
    const young = estimatePremium({ vehicleValue: 30000, driverAge: 21, state: 'NSW', garaging: 'STREET', claimsFreeYears: 0, youngDrivers: true });
    const comp = base.covers.find((c) => c.key === 'COMPREHENSIVE')!;
    expect(comp.annual).toBeGreaterThan(600);
    expect(young.covers[0].annual).toBeGreaterThan(comp.annual * 2);
    expect(base.covers.find((c) => c.key === 'TPP')!.annual).toBeLessThan(base.covers.find((c) => c.key === 'TPFT')!.annual);
    expect(comp.recommended).toBe(true);
    expect(base.ctpNote).toContain('Queensland');
    expect(base.factors.find((f) => f.key === 'garaging')!.multiplier).toBeLessThan(1);
  });

  it('recommends lighter cover on a cheap car and a discount for a second policy', () => {
    const cheap = estimatePremium({ vehicleValue: 2500, driverAge: 40, state: 'VIC' });
    expect(cheap.covers.find((c) => c.recommended)!.key).toBe('TPP');
    const multi = estimatePremium({ vehicleValue: 30000, driverAge: 40, state: 'VIC', multiPolicy: true });
    const single = estimatePremium({ vehicleValue: 30000, driverAge: 40, state: 'VIC' });
    expect(multi.covers[0].annual).toBeLessThan(single.covers[0].annual);
    const financed = estimatePremium({ vehicleValue: 2500, driverAge: 40, state: 'VIC', financed: true });
    expect(financed.covers.find((c) => c.recommended)!.key).toBe('COMPREHENSIVE');
  });
});

describe('the marketplace rules', () => {
  it('checks a VIN by shape and masks what a stranger should not see', () => {
    expect(isValidVin('JTDKN3DU0A0123456')).toBe(true);
    expect(isValidVin('JTDKN3DU0A012345O')).toBe(false);
    expect(isValidVin('short')).toBe(false);
    expect(maskVin('JTDKN3DU0A0123456')).toBe('JTD•••••••••••456');
    expect(maskRego('123ABC')).toBe('12•••C');
  });

  it('flags the things a fraud looks like and holds the worst for review', () => {
    const clean = assessListingRisk({ price: 20000, verdict: 'FAIR', photosCount: 8, vin: 'JTDKN3DU0A0123456', ppsrChecked: true, sellerAccountAgeDays: 400, description: 'Well kept, full history, happy to meet at the workshop.', odometerKm: 80000, year: 2020, serviceHistory: 'FULL', accidentHistory: 'NONE', now: new Date('2026-09-13') });
    expect(clean.flags).toHaveLength(0);
    expect(clean.band).toBe('low');
    const dodgy = assessListingRisk({ price: 9000, verdict: 'WELL_BELOW', photosCount: 0, vin: null, ppsrChecked: false, sellerAccountAgeDays: 2, description: 'Urgent sale, I am overseas, a shipping agent will deliver after a deposit to hold it.', odometerKm: 12000, year: 2018, serviceHistory: 'NONE', accidentHistory: 'NONE', now: new Date('2026-09-13') });
    expect(dodgy.holdForReview).toBe(true);
    expect(dodgy.flags.map((f) => f.key)).toEqual(expect.arrayContaining(['price_well_below', 'no_photos', 'no_vin', 'new_seller', 'urgent_language', 'low_km']));
  });

  it('walks the buyer protection states and nobody else\'s', () => {
    expect(purchaseTransition('accept', 'OFFERED', 'seller')).toEqual({ ok: true, to: 'ACCEPTED' });
    expect(purchaseTransition('accept', 'OFFERED', 'buyer').ok).toBe(false);
    expect(purchaseTransition('pay', 'ACCEPTED', 'buyer')).toEqual({ ok: true, to: 'PAID_HELD' });
    expect(purchaseTransition('release', 'PAID_HELD', 'buyer').ok).toBe(false);
    expect(purchaseTransition('dispute', 'HANDED_OVER', 'buyer')).toEqual({ ok: true, to: 'DISPUTED' });
    expect(purchaseTransition('resolve_refund', 'DISPUTED', 'seller').ok).toBe(false);
    expect(purchaseTransition('resolve_refund', 'DISPUTED', 'admin')).toEqual({ ok: true, to: 'REFUNDED' });
    expect(purchaseTransition('cancel', 'HANDED_OVER', 'seller').ok).toBe(false);
    const handed = new Date('2026-09-01T00:00:00Z');
    expect(inspectionEnds(handed, 14).toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(withinInspection(inspectionEnds(handed, 14), new Date('2026-09-10T00:00:00Z'))).toBe(true);
    expect(withinInspection(inspectionEnds(handed, 14), new Date('2026-09-16T00:00:00Z'))).toBe(false);
    expect(purchaseFee('PRIVATE', 20000)).toBe(1200);
    expect(purchaseFee('DEALER', 20000)).toBe(800);
  });

  it('reads an inspection report and decides the outcome', () => {
    const report = normaliseInspectionReport([{ key: 'body', result: 'PASS' }, { key: 'tyres', result: 'ADVISORY', notes: 'Fronts at 3 mm' }, { key: 'nonsense', result: 'FAIL' }]);
    expect(report).toHaveLength(2);
    expect(inspectionOutcome(report)).toBe('ADVISORIES');
    expect(inspectionOutcome([...report, { result: 'FAIL' }])).toBe('FAIL');
    expect(inspectionOutcome([{ result: 'PASS' }])).toBe('PASS');
  });
});

describe('the garage', () => {
  const now = new Date('2026-09-13T00:00:00Z');
  const car = { id: 'v1', make: 'Mazda', model: 'CX-5', year: 2021, odometerKm: 60000, odometerAt: new Date('2026-03-13T00:00:00Z'), kmPerYear: 15000, serviceIntervalMonths: 12, serviceIntervalKm: 15000 };

  it('projects the odometer and raises reminders by date and by kilometres', () => {
    expect(projectedOdometer(car, now)).toBeGreaterThan(67400);
    expect(projectedOdometer(car, now)).toBeLessThan(67700);
    const reminders = vehicleReminders({ ...car, nextServiceDueKm: 68000, regoDueAt: new Date('2026-09-20T00:00:00Z'), insuranceRenewsAt: new Date('2027-03-01T00:00:00Z'), warrantyEndsAt: new Date('2026-10-20T00:00:00Z') }, now);
    const kinds = reminders.map((r) => r.kind);
    expect(kinds).toContain('SERVICE');
    expect(kinds).toContain('REGO');
    expect(kinds).toContain('WARRANTY');
    expect(kinds).not.toContain('INSURANCE');
    expect(reminders.find((r) => r.kind === 'REGO')!.urgency).toBe('soon');
    expect(vehicleReminders({ ...car, nextServiceDueAt: new Date('2026-08-01T00:00:00Z') }, now)[0].urgency).toBe('overdue');
  });

  it('sends each reminder once a month and works out the next service', () => {
    expect(shouldSend(null, 'rego:2026-09-20', now)).toBe(true);
    const sent = markSent(null, 'rego:2026-09-20', now);
    expect(shouldSend(sent, 'rego:2026-09-20', new Date('2026-09-20T00:00:00Z'))).toBe(false);
    expect(shouldSend(sent, 'rego:2026-09-20', new Date('2026-10-20T00:00:00Z'))).toBe(true);
    const nxt = nextServiceAfter(new Date('2026-09-13T00:00:00Z'), 67500, 12, 15000);
    expect(nxt.dueAt.toISOString().slice(0, 10)).toBe('2027-09-13');
    expect(nxt.dueKm).toBe(82500);
  });

  it('sums a quote by kind, prices from the workshop\'s list or the typical range, and rates by completed jobs only', () => {
    const lines = normaliseQuoteLines([{ label: 'Pads', amount: 180, kind: 'PARTS' }, { label: 'Fit', amount: 120.5, kind: 'LABOUR' }, { label: '', amount: 5 }, { label: 'Disposal', amount: 10 }]);
    expect(lines).toHaveLength(3);
    expect(quoteTotal(lines)).toEqual({ total: 310.5, parts: 180, labour: 120.5, other: 10 });
    expect(priceFor([{ kind: 'logbook', from: 299, to: 399 }], 'logbook')).toMatchObject({ from: 299, own: true });
    expect(priceFor(null, 'brakes')).toMatchObject({ from: 250, to: 800, own: false });
    expect(bookingMinutes('logbook', 60)).toBe(120);
    expect(recomputeMechanicRating([{ rating: 5, transparency: 4 }, { rating: 1, transparency: 1, isHidden: true }])).toEqual({ ratingAvg: 5, ratingCount: 1, transparencyAvg: 4 });
    expect(recomputeCarRating([{ rating: 4, reliability: 5 }, { rating: 2, reliability: 3 }])).toEqual({ ratingAvg: 3, ratingCount: 2, reliabilityAvg: 4 });
  });
});

describe('the library', () => {
  it('dates every rating and lapses the old ones', () => {
    const now = new Date('2026-09-13T00:00:00Z');
    expect(ancapStatus(5, 2024, now).status).toBe('current');
    expect(ancapStatus(5, 2018, now).status).toBe('expired');
    expect(ancapStatus(null, null, now).status).toBe('unrated');
    expect(CAR_SEEDS.length).toBeGreaterThan(30);
    expect(new Set(CAR_SEEDS.map((c) => c.slug)).size).toBe(CAR_SEEDS.length);
    const featureKeys = new Set(SAFETY_FEATURES.map((f) => f.key));
    expect(CAR_SEEDS.every((c) => c.safetyFeatures.every((k) => featureKeys.has(k)))).toBe(true);
    expect(SERVICE_KINDS.every((s) => s.from <= s.to)).toBe(true);
  });
});

describe('the referral ledger, emissions and the quote comparison', () => {
  it('prices a dealership sale between the floor and the ceiling, and the other kinds by their share', () => {
    expect(dealerSaleFee(15000)).toBe(200);
    expect(dealerSaleFee(35000)).toBe(350);
    expect(dealerSaleFee(90000)).toBe(500);
    expect(dealerSaleFee(0)).toBe(0);
    expect(referralFee('FINANCE', 30000)).toEqual({ fee: 300, percent: 1 });
    expect(referralFee('INSURANCE', 1200).fee).toBe(180);
    expect(referralFee('WARRANTY', 2000).fee).toBe(200);
    expect(referralFee('FLEET', 5000).fee).toBe(0);
    expect(summariseReferrals([{ kind: 'FINANCE', status: 'PENDING', fee: 300 }, { kind: 'DEALER_SALE', status: 'PAID', fee: 400 }, { kind: 'PARTS', status: 'VOID', fee: 50 }])).toEqual({ pending: 300, confirmed: 0, paid: 400, byKind: { FINANCE: { count: 1, fee: 300 }, DEALER_SALE: { count: 1, fee: 400 } } });
  });

  it('derives tailpipe emissions from the published consumption and says when a car has none', () => {
    expect(co2ForCar('PETROL', 7.0).gramsKm).toBe(162);
    expect(co2ForCar('DIESEL', 7.5).gramsKm).toBe(201);
    expect(co2ForCar('PLUG_IN_HYBRID', 6.5).gramsKm).toBe(60);
    expect(co2ForCar('ELECTRIC', null).gramsKm).toBe(0);
    expect(co2ForCar('PETROL', null).gramsKm).toBeNull();
    expect(co2ForCar('PETROL', 7.0, 158)).toEqual({ gramsKm: 158, label: expect.stringContaining('official') });
  });

  it('tells the cheapest premium from the best value once the excess and the extras are counted', () => {
    const r = compareInsuranceQuotes({ vehicleValue: 25000, quotes: [
      { insurer: 'Cheap', annual: 900, excess: 2000 },
      { insurer: 'Fair', annual: 1050, excess: 700, hireCar: true, roadside: true, windscreen: true, choiceOfRepairer: true },
      { insurer: 'Monthly', annual: 950, monthlyTotal: 1090, excess: 800 },
    ] });
    expect(r.cheapest).toBe('Cheap');
    expect(r.bestValue).toBe('Fair');
    expect(r.quotes[0].insurer).toBe('Fair');
    expect(r.quotes[0].allIn).toBe(1134);
    expect(r.quotes.find((q) => q.insurer === 'Cheap')!.flags.join(' ')).toContain('excess');
    expect(r.quotes.find((q) => q.insurer === 'Cheap')!.missing).toEqual(['hire car', 'roadside assistance', 'windscreen without excess']);
    expect(r.quotes.find((q) => q.insurer === 'Monthly')!.monthlyLoading).toBe(140);
    expect(r.spreadPct).toBe(21);
    expect(compareInsuranceQuotes({ quotes: [] }).quotes).toHaveLength(0);
  });
});
