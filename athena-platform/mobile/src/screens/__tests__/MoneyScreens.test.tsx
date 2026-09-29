/**
 * The money pillars, rendered: the plans and their calculators, savings
 * goals, super and the health score, and business registrations.
 *
 * Pinned here: a blank field is never sent as zero and a required one is
 * named before anything is sent; a rate the server sends as a fraction is
 * printed as the percentage it is; each part of the finance screen fails on
 * its own, and a failure is never drawn as "nothing yet"; a new goal carries
 * no automatic saving, which ATHENA cannot perform; and a registration a
 * reviewer asked about shows what was asked and goes back for review without
 * a second fee.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';

const mockPlans = jest.fn<(...args: any[]) => any>();
const mockReference = jest.fn<(...args: any[]) => any>();
const mockTaxEstimate = jest.fn<(...args: any[]) => any>();
const mockRent = jest.fn<(...args: any[]) => any>();
const mockRisk = jest.fn<(...args: any[]) => any>();
const mockGoals = jest.fn<(...args: any[]) => any>();
const mockCreateGoal = jest.fn<(...args: any[]) => any>();
const mockContribute = jest.fn<(...args: any[]) => any>();
const mockUpdateGoal = jest.fn<(...args: any[]) => any>();
const mockSuper = jest.fn<(...args: any[]) => any>();
const mockScore = jest.fn<(...args: any[]) => any>();
const mockFormationList = jest.fn<(...args: any[]) => any>();
const mockFormationGet = jest.fn<(...args: any[]) => any>();
const mockFormationDocs = jest.fn<(...args: any[]) => any>();
const mockFormationDoc = jest.fn<(...args: any[]) => any>();
const mockProvideInfo = jest.fn<(...args: any[]) => any>();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, unknown> = {};

jest.mock('../../services/api', () => ({
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

jest.mock('../../services/money', () => {
  const actual = jest.requireActual('../../services/money') as Record<string, unknown>;
  const none = () => Promise.reject(new Error('not used in this test'));
  return {
    ...actual,
    strategyApi: {
      reference: (...args: unknown[]) => mockReference(...args),
      plans: (...args: unknown[]) => mockPlans(...args),
      housing: { rent: (...args: unknown[]) => mockRent(...args), stampDuty: none, mortgage: none, borrowingPower: none, deposit: none, rentVsBuy: none },
      business: { structures: none, valuation: none, raise: none, runway: none },
      tax: { estimate: (...args: unknown[]) => mockTaxEstimate(...args), deductions: none, superPlan: none, setAside: none },
      investing: { riskProfile: (...args: unknown[]) => mockRisk(...args), emergencyFund: none, projection: none },
    },
    financeApi: {
      goals: (...args: unknown[]) => mockGoals(...args),
      createGoal: (...args: unknown[]) => mockCreateGoal(...args),
      contribute: (...args: unknown[]) => mockContribute(...args),
      updateGoal: (...args: unknown[]) => mockUpdateGoal(...args),
      superAccounts: (...args: unknown[]) => mockSuper(...args),
      healthScore: (...args: unknown[]) => mockScore(...args),
    },
    formationApi: {
      list: (...args: unknown[]) => mockFormationList(...args),
      get: (...args: unknown[]) => mockFormationGet(...args),
      documents: (...args: unknown[]) => mockFormationDocs(...args),
      document: (...args: unknown[]) => mockFormationDoc(...args),
      provideInfo: (...args: unknown[]) => mockProvideInfo(...args),
    },
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace, goBack: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => effect(), [effect]);
  },
}));

import { buildBody, findCalculator, planFigures, CALCULATORS } from '../money/calculators';
import { CalculatorScreen } from '../money/CalculatorScreen';
import { StrategyScreen } from '../money/StrategyScreen';
import { MyPlansScreen } from '../money/MyPlansScreen';
import { FinanceScreen } from '../money/FinanceScreen';
import { SavingsGoalScreen } from '../money/SavingsGoalScreen';
import { FormationScreen } from '../money/FormationScreen';
import { FormationDetailScreen, formatAbn } from '../money/FormationDetailScreen';
import { byLabel, press, pressableWithText, renderScreen, settle, shows, unmountScreens, visibleText } from './renderScreen';

jest.setTimeout(30_000);

const answered = (data: unknown) => Promise.resolve({ data: { success: true, data } });
const offline = () => Promise.reject(new Error('Network Error'));

async function type(screen: Awaited<ReturnType<typeof renderScreen>>, label: string, value: string) {
  await act(async () => {
    byLabel(screen, label)?.props.onChangeText(value);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  unmountScreens();
  jest.restoreAllMocks();
});

describe('the calculators', () => {
  it('leaves a blank optional field out rather than sending zero, and names a missing required one', () => {
    const rent = findCalculator('rent')!;
    expect(buildBody(rent.fields, { annualIncome: '80000', partnerAnnualIncome: '' })).toEqual({ body: { annualIncome: 80000 }, missing: [], invalid: [] });
    expect(buildBody(rent.fields, {}).missing).toEqual(['Your income, a year, before tax']);
  });

  it('sends a toggle only once she has answered it', () => {
    const duty = findCalculator('stamp-duty')!;
    expect(buildBody(duty.fields, { state: 'QLD', price: '600000', firstHome: 'yes' }).body).toEqual({ state: 'QLD', price: 600000, firstHome: true });
    expect(buildBody(duty.fields, { state: 'QLD', price: '600000' }).body).toEqual({ state: 'QLD', price: 600000 });
  });

  it('has a calculator for every area it lists, each with a unique key', () => {
    const keys = CALCULATORS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const area of ['HOUSING', 'BUSINESS', 'TAX', 'INVESTMENT'] as const) {
      expect(CALCULATORS.some((c) => c.area === area)).toBe(true);
    }
  });

  it('reads a saved plan with the figure names the web saves, and draws only the figures it holds', () => {
    expect(planFigures('HOUSING', { cashNeeded: 58000, ahead: 'renting' })).toEqual([
      { label: 'Cash needed on the day', value: '$58,000' },
      { label: 'Ahead after the years chosen', value: 'Renting' },
    ]);
  });
});

describe('CalculatorScreen', () => {
  it('names the missing field and sends nothing', async () => {
    mockParams = { calculator: 'tax-estimate' };

    const screen = await renderScreen(<CalculatorScreen />);
    await press(pressableWithText(screen, 'Work it out')!);

    expect(mockTaxEstimate).not.toHaveBeenCalled();
    expect(shows(screen, 'Fill in: Salary, a year, before tax')).toBe(true);
  });

  it('prints a marginal rate the server sends as a fraction as the percentage it is', async () => {
    mockParams = { calculator: 'tax-estimate' };
    mockTaxEstimate.mockReturnValue(
      answered({ asAt: '2025-26 financial year', taxableIncome: 90000, incomeTax: 17788, lito: 0, medicareLevy: 1800, helpRepayment: 0, totalTax: 19588, netIncome: 70412, monthlyTakeHome: 5868, fortnightlyTakeHome: 2708, marginalRate: 0.3, effectiveRate: 21.76, employerSuper: 10800, notes: ['An estimate.'] })
    );

    const screen = await renderScreen(<CalculatorScreen />);
    await type(screen, 'Salary, a year, before tax', '90000');
    await press(pressableWithText(screen, 'Work it out')!);
    await settle();

    expect(mockTaxEstimate).toHaveBeenCalledWith({ grossIncome: 90000 });
    const text = visibleText(screen);
    expect(text).toContain('$5,868');
    expect(text).toContain('30%, before Medicare');
    expect(text).toContain('Rates and thresholds for the 2025-26 financial year.');
  });

  it('shows the server’s refusal in its own words under the button', async () => {
    mockParams = { calculator: 'rent' };
    mockRent.mockRejectedValue({ response: { status: 400, data: { message: 'annualIncome: Number must be less than or equal to 1000000000' } } });

    const screen = await renderScreen(<CalculatorScreen />);
    await type(screen, 'Your income, a year, before tax', '99999999999');
    await press(pressableWithText(screen, 'Work it out')!);
    await settle();

    expect(shows(screen, 'annualIncome: Number must be less than')).toBe(true);
  });

  it('asks the server’s own risk questions and sends her answers by question', async () => {
    mockParams = { calculator: 'risk-profile' };
    mockReference.mockReturnValue(
      answered({
        asAt: '2025-26 financial year',
        investing: {
          questions: [
            { id: 'horizon', text: 'When will you need most of this money?', options: [{ score: 1, label: 'Within 3 years' }, { score: 4, label: 'More than 10 years' }] },
            { id: 'drop', text: 'Your investments fall 20% in a bad year. You would...', options: [{ score: 2, label: 'Move some to cash' }, { score: 3, label: 'Hold on' }] },
          ],
        },
      })
    );
    mockRisk.mockReturnValue(answered({ asAt: '2025-26 financial year', label: 'Growth', summary: 'Mostly growth.', growthPct: 70, defensivePct: 30, allocation: [], expectedReturnPct: 7, volatilityPct: 14, cappedBy: null, notes: [] }));

    const screen = await renderScreen(<CalculatorScreen />);
    await press(pressableWithText(screen, 'More than 10 years')!);
    await press(pressableWithText(screen, 'Hold on')!);
    await press(pressableWithText(screen, 'Work it out')!);
    await settle();

    expect(mockRisk).toHaveBeenCalledWith({ answers: { horizon: 4, drop: 3 } });
    expect(shows(screen, '70% growth, 30% defensive')).toBe(true);
  });
});

describe('StrategyScreen and MyPlansScreen', () => {
  it('keeps the calculators usable when the saved plan could not be read', async () => {
    mockParams = { area: 'TAX' };
    mockPlans.mockImplementation(offline);

    const screen = await renderScreen(<StrategyScreen />);

    expect(shows(screen, 'Your saved plan could not be read')).toBe(true);
    expect(shows(screen, 'Nothing saved for tax yet')).toBe(false);
    expect(pressableWithText(screen, 'Tax and take-home')).not.toBeNull();
  });

  it('says there are no plans only when the server answered with none', async () => {
    mockPlans.mockReturnValue(answered([]));
    const screen = await renderScreen(<MyPlansScreen />);
    expect(shows(screen, 'No plans saved yet')).toBe(true);

    unmountScreens();
    mockPlans.mockImplementation(offline);
    const failed = await renderScreen(<MyPlansScreen />);
    expect(shows(failed, 'Your plans could not be read')).toBe(true);
    expect(shows(failed, 'No plans saved yet')).toBe(false);
  });
});

describe('FinanceScreen', () => {
  it('lets each part fail on its own, and never draws a failure as "no goals yet"', async () => {
    mockGoals.mockImplementation(offline);
    mockSuper.mockReturnValue(answered({ accounts: [{ id: 's1', fundName: 'AustralianSuper', balance: '48210.55', investmentOpt: null, insuranceInc: false }], totalBalance: 48210.55 }));
    mockScore.mockReturnValue(
      answered({ overallScore: 41, emergencyFundScore: 20, superScore: 60, insuranceScore: 30, savingsRateScore: 50, recommendations: { items: ['Build your emergency fund'], measures: { savingsRate: 'Whether you have set any savings goal. ATHENA does not see your income or spending, so this is not a measured savings rate.' } } })
    );

    const screen = await renderScreen(<FinanceScreen />);

    expect(shows(screen, 'Your goals could not be read')).toBe(true);
    expect(shows(screen, 'No savings goals yet')).toBe(false);
    expect(shows(screen, 'AustralianSuper')).toBe(true);
    expect(shows(screen, '$48,211')).toBe(true);
    expect(shows(screen, 'ATHENA has no feed from your fund')).toBe(true);
    // The score is shown with what each part actually counts.
    expect(shows(screen, 'this is not a measured savings rate')).toBe(true);
  });
});

describe('SavingsGoalScreen', () => {
  it('creates a goal with a date and no automatic saving, then opens it', async () => {
    mockCreateGoal.mockReturnValue(answered({ id: 'g-new' }));

    const screen = await renderScreen(<SavingsGoalScreen />);
    await type(screen, 'What it is for', 'Safety net');
    await type(screen, 'Target', '6000');
    await press(pressableWithText(screen, 'Save the goal')!);
    await settle();

    const body = mockCreateGoal.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Safety net', type: 'EMERGENCY_FUND', targetAmount: 6000 });
    expect(body.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body).not.toHaveProperty('autoSaveEnabled');
    expect(mockReplace).toHaveBeenCalledWith('SavingsGoal', { goalId: 'g-new' });
  });

  it('records money she put aside herself, and says ATHENA moved none', async () => {
    mockParams = { goalId: 'g1' };
    mockGoals.mockReturnValue(answered([{ id: 'g1', name: 'Deposit', type: 'HOME_DEPOSIT', status: 'ACTIVE', targetAmount: '20000.00', currentAmount: '5000.00', targetDate: null, monthlyTarget: null, progressPct: 25, contributions: [] }]));
    mockContribute.mockReturnValue(Promise.resolve({ data: { success: true, data: {}, message: 'Contribution added' } }));

    const screen = await renderScreen(<SavingsGoalScreen />);
    expect(shows(screen, 'ATHENA does not move money')).toBe(true);
    await type(screen, 'Amount', '250');
    await press(pressableWithText(screen, 'Record it')!);
    await settle();

    expect(mockContribute).toHaveBeenCalledWith('g1', { amount: 250 });
  });

  it('says a goal is gone only when it is not in her list', async () => {
    mockParams = { goalId: 'missing' };
    mockGoals.mockReturnValue(answered([]));
    const screen = await renderScreen(<SavingsGoalScreen />);
    expect(shows(screen, 'This goal is no longer there')).toBe(true);

    unmountScreens();
    mockGoals.mockImplementation(offline);
    const failed = await renderScreen(<SavingsGoalScreen />);
    expect(shows(failed, 'This goal could not be read')).toBe(true);
  });
});

describe('Formation', () => {
  const registration = {
    id: 'r1',
    type: 'COMPANY',
    status: 'ADDITIONAL_INFO_REQUIRED',
    businessName: 'Harbour Studio Pty Ltd',
    abn: null,
    acn: null,
    data: { infoRequested: 'A second director’s residential address, please.' },
    submittedAt: '2026-09-01T00:00:00.000Z',
    approvedAt: null,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };

  it('lists registrations with the web’s words for where each is up to', async () => {
    mockFormationList.mockReturnValue(Promise.resolve({ data: [registration] }));
    const screen = await renderScreen(<FormationScreen />);
    expect(shows(screen, 'Harbour Studio Pty Ltd')).toBe(true);
    expect(shows(screen, 'We need something from you')).toBe(true);
  });

  it('says the list could not be read rather than that there are none', async () => {
    mockFormationList.mockImplementation(offline);
    const screen = await renderScreen(<FormationScreen />);
    expect(shows(screen, 'Your registrations could not be read')).toBe(true);
    expect(shows(screen, 'No registrations yet')).toBe(false);
  });

  it('shows what the reviewer asked for, and sends it back without a second fee once she confirms', async () => {
    mockParams = { registrationId: 'r1' };
    mockFormationGet.mockReturnValue(Promise.resolve({ data: registration }));
    mockFormationDocs.mockReturnValue(answered({ generatedAt: null, items: [], available: [{ key: 'constitution', title: 'Constitution', purpose: 'The company’s rules' }] }));
    mockProvideInfo.mockReturnValue(Promise.resolve({ data: { ...registration, status: 'UNDER_REVIEW' } }));

    const screen = await renderScreen(<FormationDetailScreen />);
    expect(shows(screen, 'A second director’s residential address')).toBe(true);
    expect(shows(screen, 'One document is ready to be generated')).toBe(true);

    await press(pressableWithText(screen, 'Send it back for review')!);
    const [, body, buttons] = (Alert.alert as unknown as jest.Mock).mock.calls[0] as [string, string, Array<{ text: string; onPress?: () => Promise<void> }>];
    expect(body).toContain('nothing more to pay');
    await act(async () => {
      await buttons.find((b) => b.text === 'Send it back')?.onPress?.();
    });
    expect(mockProvideInfo).toHaveBeenCalledWith('r1');
  });

  it('writes an ABN the way it is printed', () => {
    expect(formatAbn('51824753556')).toBe('51 824 753 556');
  });

  it('reads a bare registration as the registration, not as its own details column', () => {
    // unwrapApiData reads `.data` first, and a registration has a `data`
    // column, so it used to hand back the details in place of the row.
    const { formationBody } = jest.requireActual('../../services/money') as typeof import('../../services/money');
    expect(formationBody<{ id: string }>(registration).id).toBe('r1');
    expect(formationBody<{ id: string }>({ success: true, data: registration }).id).toBe('r1');
    expect(formationBody<unknown[]>([registration])).toHaveLength(1);
  });
});
