/**
 * A pitch deck outline from the pitch check: the "pitch deck templates"
 * the blueprint lists, built from what the founder has already written.
 *
 * Ten slides in the order investors expect, each carrying the founder's
 * own words where she gave them and the question to answer where she did
 * not. It is a Markdown file to paste into whatever she builds slides in.
 */

import { PITCH_SECTIONS, PitchInput, PitchSection } from './investor-match.service';

export interface DeckSlide {
  number: number;
  title: string;
  body: string;
  fromPitch: boolean;
}

export interface DeckOutline {
  businessName: string;
  slides: DeckSlide[];
  markdown: string;
}

const SLIDE_TITLES: Record<PitchSection, string> = {
  problem: 'The problem',
  solution: 'What we built',
  market: 'Who has this problem, and what they spend',
  model: 'How we make money',
  traction: 'What has happened so far',
  competition: 'Why us, not them',
  team: 'Who we are',
  ask: 'The raise',
  useOfFunds: 'What the money buys',
  whyNow: 'Why now',
};

const firstSentence = (s: string) => (s.match(/[^.!?]+[.!?]?/)?.[0] ?? s).trim();

export function buildDeckOutline(input: PitchInput & { businessName?: string }): DeckOutline {
  const name = (input.businessName ?? '').trim() || 'Your company';
  const sections = input.sections ?? {};
  const text = (input.text ?? '').trim();
  const oneLiner = sections.solution ? firstSentence(sections.solution) : text ? firstSentence(text) : '[One sentence: who you help and what changes for them]';

  const slides: DeckSlide[] = [{ number: 1, title: name, body: oneLiner, fromPitch: Boolean(sections.solution || text) }];
  for (const s of PITCH_SECTIONS) {
    const own = (sections[s.key] ?? '').trim();
    slides.push({ number: slides.length + 1, title: SLIDE_TITLES[s.key], body: own || `[${s.prompt}]`, fromPitch: Boolean(own) });
  }
  slides.push({ number: slides.length + 1, title: 'Thank you', body: '[Your name, email and the one thing you want from this room: a meeting, an introduction, a cheque.]', fromPitch: false });

  const markdown = `# ${name}: pitch deck outline\n\n${slides.map((sl) => `## Slide ${sl.number}: ${sl.title}\n\n${sl.body}\n`).join('\n')}\n---\n*Square brackets are questions still to answer. One idea a slide, one number per idea, and nothing on a slide you would not say out loud. Prepared in ATHENA.*\n`;
  return { businessName: name, slides, markdown };
}
