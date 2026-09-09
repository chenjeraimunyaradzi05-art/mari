/**
 * The investor side of the capital marketplace: which of the listed
 * investors a business fits, scored the way the grant matcher scores
 * grants, and a pitch readiness check.
 *
 * The pitch check is a rule-based read of what a pitch covers, not a
 * judge of whether it is any good. It looks for the ten things every
 * investor listens for, tells the founder which are missing and what to
 * add, and scores what is there. That is the "pitch feedback" the
 * blueprint asks for, done honestly with no model behind it.
 */

export interface InvestorProfile {
  stage?: string;
  industry?: string;
  state?: string;
  raiseAmount?: number;
  investorTypes?: string[];
}

export interface InvestorLike {
  id: string;
  name: string;
  type: string;
  minCheckSize?: unknown;
  maxCheckSize?: unknown;
  stages?: string[] | null;
  industries?: string[] | null;
  regions?: string[] | null;
  isVerified?: boolean | null;
}

export interface InvestorMatch {
  investorId: string;
  score: number;
  reasons: string[];
  gaps: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hasAny = (list: string[] | null | undefined, ...needles: string[]) => (list ?? []).some((v) => needles.some((n) => norm(v).includes(norm(n)) || norm(n).includes(norm(v))));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number) => `$${n.toLocaleString('en-AU')}`;

export function scoreInvestor(investor: InvestorLike, profile: InvestorProfile): InvestorMatch {
  let score = 0;
  const reasons: string[] = [];
  const gaps: string[] = [];

  const stages = investor.stages ?? [];
  if (profile.stage) {
    if (stages.length === 0 || hasAny(stages, 'any', 'all')) { score += 20; reasons.push('Invests at any stage'); }
    else if (hasAny(stages, profile.stage)) { score += 30; reasons.push(`Backs ${profile.stage.toLowerCase()} stage businesses`); }
    else gaps.push(`Invests at ${stages.join(', ').toLowerCase()} stage`);
  } else score += 15;

  const inds = investor.industries ?? [];
  if (profile.industry) {
    if (inds.length === 0 || hasAny(inds, 'any', 'all', 'generalist')) { score += 15; reasons.push('Sector agnostic'); }
    else if (hasAny(inds, profile.industry)) { score += 25; reasons.push(`Focuses on ${profile.industry.toLowerCase()}`); }
    else gaps.push(`Focuses on ${inds.join(', ').toLowerCase()}`);
  } else score += 12;

  const regions = investor.regions ?? [];
  if (profile.state) {
    if (regions.length === 0 || hasAny(regions, 'national', 'australia', 'all', 'any', 'global')) { score += 15; reasons.push('Invests Australia-wide'); }
    else if (hasAny(regions, profile.state)) { score += 15; reasons.push(`Active in ${profile.state}`); }
    else gaps.push(`Invests in ${regions.join(', ')}`);
  } else score += 10;

  const min = num(investor.minCheckSize);
  const max = num(investor.maxCheckSize);
  if (profile.raiseAmount && profile.raiseAmount > 0) {
    if (max > 0 && profile.raiseAmount > max * 4) { score += 5; gaps.push(`Cheques up to ${money(max)}, a small slice of your round`); }
    else if (min > 0 && profile.raiseAmount < min) { score += 8; gaps.push(`Minimum cheque is ${money(min)}, more than you are raising`); }
    else { score += 20; reasons.push(max > 0 ? `Cheque size fits: ${money(min)} to ${money(max)}` : 'Cheque size fits'); }
  } else score += 12;

  if (profile.investorTypes?.length) {
    if (profile.investorTypes.map(norm).includes(norm(investor.type))) { score += 10; reasons.push(`A ${investor.type.replace(/_/g, ' ').toLowerCase()}, as you asked`); }
    else score += 4;
  } else score += 7;

  if (investor.isVerified) { score += 5; reasons.push('Verified by ATHENA'); }

  return { investorId: investor.id, score: Math.min(100, score), reasons, gaps };
}

export function rankInvestors<T extends InvestorLike>(investors: T[], profile: InvestorProfile): Array<T & { match: InvestorMatch }> {
  return investors.map((i) => ({ ...i, match: scoreInvestor(i, profile) })).sort((a, b) => b.match.score - a.match.score);
}

// ---------------------------------------------------------------- pitch

export type PitchSection = 'problem' | 'solution' | 'market' | 'model' | 'traction' | 'competition' | 'team' | 'ask' | 'useOfFunds' | 'whyNow';

export const PITCH_SECTIONS: Array<{ key: PitchSection; label: string; weight: number; keywords: string[]; prompt: string }> = [
  { key: 'problem', label: 'The problem', weight: 12, keywords: ['problem', 'pain', 'struggle', 'frustrat', 'costs them', 'every year', 'nobody', 'today they'], prompt: 'Who has the problem, how often, and what it costs them now.' },
  { key: 'solution', label: 'Your solution', weight: 12, keywords: ['we built', 'our product', 'our platform', 'solution', 'we help', 'lets them', 'app', 'service'], prompt: 'What you built and what changes for the customer the first time they use it.' },
  { key: 'market', label: 'The market', weight: 10, keywords: ['market', 'tam', 'sam', 'billion', 'million customers', 'addressable', 'segment', 'australia has'], prompt: 'How many people have the problem and what they spend on it: bottom-up, not a percentage of a billion.' },
  { key: 'model', label: 'How you make money', weight: 10, keywords: ['revenue', 'subscription', 'per month', 'pricing', 'we charge', 'commission', 'margin', 'business model', 'ltv', 'cac'], prompt: 'Who pays, how much, how often, and the margin on it.' },
  { key: 'traction', label: 'Traction', weight: 15, keywords: ['customers', 'users', 'revenue of', 'growing', 'month on month', 'retention', 'signed', 'pilot', 'waitlist', 'paying'], prompt: 'Numbers that have moved: paying customers, revenue, growth rate, retention.' },
  { key: 'competition', label: 'Competition', weight: 8, keywords: ['compet', 'alternative', 'incumbent', 'unlike', 'versus', 'compared to', 'they do', 'moat', 'defensib'], prompt: 'Who else solves it, why customers choose you, and what keeps it that way.' },
  { key: 'team', label: 'The team', weight: 10, keywords: ['founder', 'our team', 'i have', 'years in', 'previously', 'background', 'co-founder', 'cto', 'built before'], prompt: 'Why you are the ones: what you have done before that this needs.' },
  { key: 'ask', label: 'The ask', weight: 10, keywords: ['raising', 'we are raising', 'seeking', 'round', 'investment of', 'pre-money', 'safe', 'valuation'], prompt: 'How much you are raising and on what terms.' },
  { key: 'useOfFunds', label: 'Use of funds', weight: 8, keywords: ['use of funds', 'will be used', 'hire', 'spend', 'runway', 'months of', 'to reach', 'milestone'], prompt: 'What the money buys and the milestone it gets you to.' },
  { key: 'whyNow', label: 'Why now', weight: 5, keywords: ['why now', 'this year', 'regulation', 'shift', 'recently', 'now possible', 'trend', 'changed'], prompt: 'What changed in the world that makes this possible or urgent now.' },
];

export interface PitchInput {
  text?: string;
  sections?: Partial<Record<PitchSection, string>>;
}

export interface PitchCheck {
  score: number;
  grade: string;
  wordCount: number;
  found: Array<{ key: PitchSection; label: string; how: 'written' | 'mentioned' }>;
  missing: Array<{ key: PitchSection; label: string; prompt: string; weight: number }>;
  tips: string[];
}

export function checkPitch(input: PitchInput): PitchCheck {
  const text = (input.text ?? '').trim();
  const lower = text.toLowerCase();
  const sections = input.sections ?? {};
  const found: PitchCheck['found'] = [];
  const missing: PitchCheck['missing'] = [];
  let score = 0;

  for (const s of PITCH_SECTIONS) {
    const written = (sections[s.key] ?? '').trim().length >= 20;
    const mentioned = !written && s.keywords.some((k) => lower.includes(k));
    if (written || mentioned) {
      score += written ? s.weight : Math.round(s.weight * 0.7);
      found.push({ key: s.key, label: s.label, how: written ? 'written' : 'mentioned' });
    } else {
      missing.push({ key: s.key, label: s.label, prompt: s.prompt, weight: s.weight });
    }
  }

  const all = `${text} ${Object.values(sections).join(' ')}`;
  const words = all.split(/\s+/).filter(Boolean).length;
  const numbers = (all.match(/\$?\d[\d,.]*\s?(k|m|%|million|billion|customers|users)?/gi) ?? []).length;
  const tips: string[] = [];
  if (numbers < 3) tips.push('Fewer than three numbers. Investors remember figures: customers, revenue, growth, the ask.');
  if (words > 0 && words < 120) tips.push('Short for a pitch. Two minutes spoken is about 250 words.');
  if (words > 700) tips.push('Long for a first pitch. Cut to what an investor needs to ask for a meeting.');
  if (!/\$\s?\d/.test(all)) tips.push('No dollar figure. Say how much you are raising, in dollars, early.');
  if (/\b(disrupt|revolutioni[sz]e|game.?chang|uber for|world.?class|synerg)/i.test(all)) tips.push('Drop the disruption language; a plain sentence about what changes for the customer lands harder.');
  if (/\b(women|female|founder)\b/i.test(all) && !/\b(impact|underserved|overlooked)\b/i.test(all)) tips.push('If being women-led is part of the story, say what it lets you see or reach that others miss.');
  if (numbers >= 3 && missing.length === 0) tips.push('Every section is here. Now cut it by a third and see what survives.');

  score = Math.min(100, score);
  const grade = score >= 85 ? 'Ready to send' : score >= 65 ? 'Nearly there' : score >= 40 ? 'A draft' : 'Just started';
  return { score, grade, wordCount: words, found, missing: missing.sort((a, b) => b.weight - a.weight), tips };
}
