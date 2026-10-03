/**
 * The numbers to ring when someone is in danger or in crisis, carried in the
 * code so that nothing has to load for them.
 *
 * The Emergency help button is on every page a signed-in member sees, and its
 * whole worth is that it opens at once on a bad signal, with the API down, or
 * while a page is still loading. So it reads this list and asks nobody. The
 * Australian lines are the same three the phone app falls back to
 * (mobile/src/components/pillar/CrisisLines.tsx ALWAYS_ANSWERED) and the wellness
 * library publishes (server services/wellness/wellness-library.ts CRISIS_LINES);
 * the other regions carry the lines the server's DV resources already hold
 * (services/dv-safe.service.ts BUILT_IN_SUPPORT_LINES) and the emergency number of
 * the place. Nothing here is invented, and nothing here is a place ATHENA can
 * send anyone: it is a list of other people's phones.
 *
 * BEFORE LAUNCH, and after any change of number: check every line against the
 * service's own published number (triplezero.gov.au, 1800respect.org.au,
 * lifeline.org.au, and the NZ, UK and US lines at their own sites). A crisis line
 * that has moved is worse than none, and nothing in this repository will notice
 * on its own.
 */

export interface CrisisLine {
  key: string;
  name: string;
  /** As it is written and spoken, with its spaces. */
  phone: string;
  /** What it is for, in a few plain words. */
  description: string;
}

export type CrisisRegion = 'AU' | 'NZ' | 'UK' | 'US' | 'EU';

export interface CrisisSet {
  /** Null when this list has nothing for the member's region yet. */
  region: CrisisRegion | null;
  /** Where the lines are answered, for the heading under the list. */
  regionLabel: string;
  lines: CrisisLine[];
  /** A sentence about the places these numbers do not work, or null. */
  elsewhere: string | null;
}

const AUSTRALIA: CrisisLine[] = [
  { key: 'emergency', name: 'Emergency', phone: '000', description: 'Police, fire and ambulance. Call if you are in danger now, or if you are not sure.' },
  { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', description: 'Domestic, family and sexual violence counselling, any hour.' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', description: 'Someone to talk to if today is too much, any hour.' },
];

const LINES_BY_REGION: Record<CrisisRegion, { label: string; lines: CrisisLine[] }> = {
  AU: { label: 'Australia', lines: AUSTRALIA },
  NZ: {
    label: 'New Zealand',
    lines: [
      { key: 'emergency', name: 'Emergency', phone: '111', description: 'Police, fire and ambulance. Call if you are in danger now.' },
      { key: 'womens-refuge', name: "Women's Refuge", phone: '0800 733 843', description: 'A crisis line for women and children, any hour.' },
    ],
  },
  UK: {
    label: 'the United Kingdom',
    lines: [
      { key: 'emergency', name: 'Emergency', phone: '999', description: 'Police, fire and ambulance. Call if you are in danger now.' },
      { key: 'national-da-helpline', name: 'National Domestic Abuse Helpline', phone: '0808 2000 247', description: 'Run by Refuge, for women living with abuse, any hour.' },
    ],
  },
  US: {
    label: 'the United States',
    lines: [
      { key: 'emergency', name: 'Emergency', phone: '911', description: 'Police, fire and ambulance. Call if you are in danger now.' },
      { key: 'national-dv-hotline', name: 'National Domestic Violence Hotline', phone: '1-800-799-7233', description: 'Support for anyone affected by domestic violence, any hour.' },
    ],
  },
  EU: {
    label: 'the European Union',
    lines: [{ key: 'emergency', name: 'Emergency', phone: '112', description: 'The emergency number in every EU country. Call if you are in danger now.' }],
  },
};

/** The emergency numbers of the places ATHENA's members are most often in. */
const ELSEWHERE =
  'Not in Australia? Emergency numbers: New Zealand 111, United Kingdom 999, United States 911, European Union 112.';

/**
 * Which list a member's region reads. Her profile says ANZ, which holds two
 * countries with different numbers; ATHENA is an Australian company and the
 * product's default is Australian, so ANZ and a region nobody has set read the
 * Australian list, with the other countries' emergency numbers beneath it. A
 * region the code has no list for (south-east Asia, the Middle East and Africa)
 * gets none, and says so, rather than a number that will not connect.
 */
export function crisisRegionFor(region: string | null | undefined): CrisisRegion | null {
  const key = (region ?? '').trim().toUpperCase();
  if (!key || key === 'ANZ' || key === 'AU' || key === 'AUS' || key === 'AUSTRALIA') return 'AU';
  if (key === 'NZ') return 'NZ';
  if (key === 'UK' || key === 'GB') return 'UK';
  if (key === 'US' || key === 'USA') return 'US';
  if (key === 'EU') return 'EU';
  return null;
}

export function crisisLinesFor(region?: string | null): CrisisSet {
  const code = crisisRegionFor(region);
  if (!code) {
    return {
      region: null,
      regionLabel: 'your region',
      lines: [],
      elsewhere: 'We do not have a list of support lines for your region yet. Call your local emergency number if you are in danger. ' + ELSEWHERE,
    };
  }
  const found = LINES_BY_REGION[code];
  return {
    region: code,
    regionLabel: found.label,
    lines: found.lines,
    // The Australian list is the default, so it is the one that may be read by
    // someone elsewhere; the others are chosen on purpose.
    elsewhere: code === 'AU' ? ELSEWHERE : null,
  };
}

/** What a phone's dialler is given: the digits, and nothing a link could mangle. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
