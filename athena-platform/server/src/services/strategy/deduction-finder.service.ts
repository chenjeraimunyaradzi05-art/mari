/**
 * Deductible identification from the bank feed: the "tax-deductible
 * identification" and "expense categorisation" the blueprint's tax
 * dashboard promises, done with rules rather than a model.
 *
 * Each bank line's description is matched against merchant and keyword
 * rules that say what kind of spend it probably is and whether that kind
 * is usually claimable. Nothing is claimed here: the lines are grouped
 * under the deduction categories the tax plan uses, so the member can see
 * what her spending suggests, keep the receipts that matter, and carry the
 * totals into the deductions planner with one click.
 */

import { round } from './tax-plan.service';

export type DeductionKey = 'home_office' | 'car' | 'self_education' | 'tools' | 'professional_fees' | 'donations' | 'income_protection' | 'phone' | 'clothing' | 'other' | 'none';
export type Likelihood = 'likely' | 'possible' | 'no';

interface Rule {
  pattern: RegExp;
  category: string;
  key: DeductionKey;
  likelihood: Likelihood;
  reason: string;
}

const RULES: Rule[] = [
  { pattern: /\b(ato|australian taxation office|tax office)\b/i, category: 'Tax payment', key: 'none', likelihood: 'no', reason: 'Tax itself is not deductible.' },
  { pattern: /\b(woolworths|coles|aldi|iga|foodworks|harris farm|costco)\b/i, category: 'Groceries', key: 'none', likelihood: 'no', reason: 'Food is private.' },
  { pattern: /\b(netflix|spotify|stan|disney|binge|kayo|apple tv|youtube premium|paramount)\b/i, category: 'Entertainment', key: 'none', likelihood: 'no', reason: 'Streaming is private unless it is the job.' },
  { pattern: /\b(rent|real estate|property management|ray white|lj hooker|mcgrath|body corporate|strata)\b/i, category: 'Housing', key: 'none', likelihood: 'no', reason: 'Rent is private; a home office claim uses the fixed rate instead.' },
  { pattern: /\b(red cross|salvation army|salvos|unicef|oxfam|cancer council|rspca|world vision|beyond blue|smith family|lifeline|donat|st vincent|vinnies|guide dogs|mcgrath foundation)\b/i, category: 'Donation', key: 'donations', likelihood: 'likely', reason: 'Gifts of $2 or more to a deductible gift recipient.' },
  { pattern: /\b(union|cpa australia|ca anz|ahpra|aicd|engineers australia|law society|ipa\b|nurses association|nursing federation|teachers federation|membership fee|professional registration|registration fee|apra amcos|actors equity)\b/i, category: 'Professional fees', key: 'professional_fees', likelihood: 'likely', reason: 'Union, registration and professional membership fees are claimable.' },
  { pattern: /\b(income protection|tal life|zurich|aia australia|bt life|mlc insurance|onepath)\b/i, category: 'Income protection', key: 'income_protection', likelihood: 'possible', reason: 'Income protection premiums outside super are deductible; life and trauma cover are not.' },
  { pattern: /\b(telstra|optus|vodafone|tpg|aussie broadband|iinet|nbn|belong|boost mobile|amaysim|felix mobile|superloop)\b/i, category: 'Phone and internet', key: 'phone', likelihood: 'possible', reason: 'The work share is claimable under the actual cost method.' },
  { pattern: /\b(officeworks|jb hi-?fi|harvey norman|apple store|apple\.com|dell|lenovo|hp store|microsoft store|the good guys|bing lee|umart|mwave|scorptec)\b/i, category: 'Equipment', key: 'tools', likelihood: 'possible', reason: 'Tools and equipment used for work; items over $300 are claimed over their life.' },
  { pattern: /\b(bunnings|total tools|sydney tools|blackwoods|mitre 10|trade tools|toolmart)\b/i, category: 'Tools', key: 'tools', likelihood: 'possible', reason: 'Tools bought for the job are claimable in proportion to work use.' },
  { pattern: /\b(xero|myob|quickbooks|canva|adobe|microsoft 365|google workspace|notion|zoom|slack|dropbox|github|atlassian|figma|mailchimp|squarespace|shopify|godaddy|crazy domains|ventraip|hubspot|linkedin premium)\b/i, category: 'Software and subscriptions', key: 'tools', likelihood: 'possible', reason: 'Software used to earn income is claimable for its work share.' },
  { pattern: /\b(udemy|coursera|tafe|university|uni of|unsw|uq |qut|monash|rmit|linkedin learning|general assembly|open universities|textbook|booktopia|course fee|tuition|coder academy)\b/i, category: 'Self-education', key: 'self_education', likelihood: 'possible', reason: 'Claimable when the study relates to your current job.' },
  { pattern: /\b(bp|shell|caltex|ampol|7-eleven|united petroleum|puma energy|mobil|metro petroleum|fuel|petrol|servo)\b/i, category: 'Fuel', key: 'car', likelihood: 'possible', reason: 'Only work travel counts, and the cents-per-kilometre rate replaces fuel receipts.' },
  { pattern: /\b(uber|didi|ola|13cabs|cabcharge|taxi|silver top|gocatch)\b/i, category: 'Travel', key: 'car', likelihood: 'possible', reason: 'Trips between workplaces or to clients are claimable; home to work is not.' },
  { pattern: /\b(linkt|e-?toll|citylink|eastlink|transurban|wilson parking|secure parking|care park|parking)\b/i, category: 'Tolls and parking', key: 'car', likelihood: 'possible', reason: 'Tolls and parking on work trips are claimable on top of the kilometre rate.' },
  { pattern: /\b(totally workwear|workwear|uniform|hard yakka|king gee|bisley|steel blue|blundstone|dry ?clean|laundromat)\b/i, category: 'Uniform and laundry', key: 'clothing', likelihood: 'possible', reason: 'Compulsory uniform and protective wear, and washing it.' },
  { pattern: /\b(australia post|auspost|stationery|kmart|target|big w)\b/i, category: 'Supplies', key: 'other', likelihood: 'possible', reason: 'Postage and stationery for work; department stores only if it was for the job.' },
  { pattern: /\b(ikea|freedom|officeworks furniture|desk|office chair|ergonomic)\b/i, category: 'Home office furniture', key: 'home_office', likelihood: 'possible', reason: 'A desk or chair for working from home is claimable for its work share, over its life if over $300.' },
];

export interface BankLineLike {
  id?: string;
  description: string;
  amountCents: number;
  postedAt?: Date | string;
  category?: string | null;
}

export interface ClassifiedLine {
  id?: string;
  description: string;
  amount: number;
  postedAt?: string;
  category: string;
  key: DeductionKey;
  likelihood: Likelihood;
  reason: string;
}

export interface DeductionScan {
  lines: ClassifiedLine[];
  scanned: number;
  spendScanned: number;
  totals: Array<{ key: DeductionKey; label: string; likely: number; possible: number; count: number }>;
  suggestedInput: Record<string, number>;
  notes: string[];
}

const LABELS: Record<DeductionKey, string> = {
  home_office: 'Home office', car: 'Work travel', self_education: 'Self-education', tools: 'Tools, equipment and software', professional_fees: 'Union and professional fees', donations: 'Donations', income_protection: 'Income protection', phone: 'Phone and internet', clothing: 'Uniform and laundry', other: 'Other work expenses', none: 'Not deductible',
};

const INPUT_FIELD: Partial<Record<DeductionKey, string>> = {
  self_education: 'selfEducation', tools: 'toolsAndEquipment', professional_fees: 'professionalFees', donations: 'donations', income_protection: 'incomeProtectionPremiums', phone: 'phoneAndInternet', clothing: 'workClothing', other: 'other',
};

export function classifyLine(line: BankLineLike): ClassifiedLine {
  const amount = Math.abs(line.amountCents) / 100;
  const base = { id: line.id, description: line.description, amount: round(amount * 100) / 100, postedAt: line.postedAt ? new Date(line.postedAt).toISOString().slice(0, 10) : undefined };
  if (line.amountCents > 0) return { ...base, category: 'Money in', key: 'none', likelihood: 'no', reason: 'Income, not a deduction.' };
  const rule = RULES.find((r) => r.pattern.test(line.description));
  if (!rule) return { ...base, category: line.category ?? 'Uncategorised', key: 'none', likelihood: 'no', reason: 'No rule matched; only you know if this was for work.' };
  return { ...base, category: rule.category, key: rule.key, likelihood: rule.likelihood, reason: rule.reason };
}

/** Scan a set of bank lines and group what looks claimable. */
export function scanForDeductions(lines: BankLineLike[]): DeductionScan {
  const classified = lines.map(classifyLine);
  const spends = classified.filter((l) => l.likelihood !== 'no' || l.key !== 'none');
  const byKey = new Map<DeductionKey, { likely: number; possible: number; count: number }>();
  for (const l of classified) {
    if (l.key === 'none') continue;
    const t = byKey.get(l.key) ?? { likely: 0, possible: 0, count: 0 };
    if (l.likelihood === 'likely') t.likely += l.amount; else t.possible += l.amount;
    t.count += 1;
    byKey.set(l.key, t);
  }
  const totals = [...byKey.entries()]
    .map(([key, t]) => ({ key, label: LABELS[key], likely: round(t.likely), possible: round(t.possible), count: t.count }))
    .sort((a, b) => b.likely + b.possible - (a.likely + a.possible));

  const suggestedInput: Record<string, number> = {};
  for (const t of totals) {
    const field = INPUT_FIELD[t.key];
    if (field) suggestedInput[field] = round(t.likely + t.possible);
  }

  return {
    lines: spends.filter((l) => l.key !== 'none'),
    scanned: classified.length,
    spendScanned: classified.filter((l) => l.amount > 0 && l.category !== 'Money in').length,
    totals,
    suggestedInput,
    notes: [
      '"Likely" means the kind of cost the ATO accepts as a deduction outright; "possible" means it is claimable for the share used for work, which only you can say.',
      'A description is a hint, not evidence. Keep the receipt for anything you claim, and a diary for the work share of phone, internet and the car.',
      'Fuel is shown so you can see the trips, but the claim is at the cents-per-kilometre rate for work kilometres, not the fuel bill.',
      'Home office running costs are covered by the fixed hourly rate in the deductions planner; furniture over $300 is claimed over its life.',
    ],
  };
}
