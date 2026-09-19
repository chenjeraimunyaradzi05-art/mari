/**
 * Who assesses an overseas qualification in Australia, by profession.
 *
 * A migrant nurse who enters her degree should be told that ANMAC is the
 * body that assesses it, an engineer that it is Engineers Australia, an
 * accountant that it is CPA Australia or CA ANZ. This is that list: the
 * public assessing authorities, their public websites, and the words in a
 * field of study or credential name that point to each one. Nothing here
 * is a decision; it says where to apply, and the member or a staff member
 * records what the body actually decided.
 *
 * It follows the reference-data pattern in strategy/au-rates.ts and
 * rent-assistance.service.ts: public facts, carried with the date they were
 * checked, so a stale entry is visible rather than silent.
 */

export const ASSESSING_BODIES_AS_AT = 'links checked 19 September 2026';

export interface AssessingBody {
  /** The authority's full name, with its usual initials where it has them. */
  name: string;
  /** A public page on the authority's own site. */
  url: string;
  /** What the authority does for someone with an overseas qualification. */
  role: string;
}

export interface ProfessionPathway {
  /** Stable key, also the word a bridging program's `profession` is matched on. */
  id: string;
  label: string;
  /** Lower-case fragments matched against the field of study and credential name. */
  keywords: string[];
  /** The authority to start with. */
  body: AssessingBody;
  /** Registration boards and alternatives that follow or sit beside it. */
  also: AssessingBody[];
  /** One sentence the member reads next to the suggestion. */
  note: string;
}

const AHPRA = (board: string): AssessingBody => ({
  name: `${board} (through Ahpra)`,
  url: 'https://www.ahpra.gov.au',
  role: 'registration to practise in Australia, once the assessment is done',
});

/**
 * The table. Order matters only when two entries score the same number of
 * keyword hits, in which case the earlier one wins.
 */
export const PROFESSION_PATHWAYS: ProfessionPathway[] = [
  {
    id: 'nursing',
    label: 'Nursing and midwifery',
    keywords: ['nurs', 'midwif'],
    body: {
      name: 'Australian Nursing and Midwifery Accreditation Council (ANMAC)',
      url: 'https://www.anmac.org.au',
      role: 'skills assessment of an overseas nursing or midwifery qualification for migration',
    },
    also: [AHPRA('Nursing and Midwifery Board of Australia')],
    note: 'ANMAC assesses the qualification for migration; registration to work as a nurse or midwife is a separate step with the Nursing and Midwifery Board through Ahpra.',
  },
  {
    id: 'medicine',
    label: 'Medicine',
    keywords: ['medicine', 'mbbs', 'physician', 'surgeon', 'surgery', 'doctor', 'general practi'],
    body: {
      name: 'Australian Medical Council (AMC)',
      url: 'https://www.amc.org.au',
      role: 'assessment of overseas medical qualifications and the AMC examinations',
    },
    also: [AHPRA('Medical Board of Australia')],
    note: 'The AMC verifies the primary medical degree and runs the examinations; the Medical Board registers doctors through Ahpra.',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    keywords: ['pharma'],
    body: {
      name: 'Australian Pharmacy Council (APC)',
      url: 'https://www.pharmacycouncil.org.au',
      role: 'skills assessment and examinations for overseas-qualified pharmacists',
    },
    also: [AHPRA('Pharmacy Board of Australia')],
    note: 'The APC assesses the qualification and sets the exams; the Pharmacy Board registers pharmacists through Ahpra.',
  },
  {
    id: 'dentistry',
    label: 'Dentistry',
    keywords: ['dent'],
    body: {
      name: 'Australian Dental Council (ADC)',
      url: 'https://www.adc.org.au',
      role: 'assessment of overseas dental qualifications',
    },
    also: [AHPRA('Dental Board of Australia')],
    note: 'The ADC assesses overseas dental qualifications; the Dental Board registers practitioners through Ahpra.',
  },
  {
    id: 'physiotherapy',
    label: 'Physiotherapy',
    keywords: ['physio'],
    body: {
      name: 'Australian Physiotherapy Council',
      url: 'https://physiocouncil.com.au',
      role: 'assessment of overseas physiotherapy qualifications',
    },
    also: [AHPRA('Physiotherapy Board of Australia')],
    note: 'The Council assesses the qualification; the Physiotherapy Board registers physiotherapists through Ahpra.',
  },
  {
    id: 'occupational-therapy',
    label: 'Occupational therapy',
    keywords: ['occupational therap'],
    body: {
      name: 'Occupational Therapy Council of Australia',
      url: 'https://www.otcouncil.com.au',
      role: 'assessment of overseas occupational therapy qualifications',
    },
    also: [AHPRA('Occupational Therapy Board of Australia')],
    note: 'The Council assesses the qualification; the Occupational Therapy Board registers practitioners through Ahpra.',
  },
  {
    id: 'psychology',
    label: 'Psychology',
    keywords: ['psycholog'],
    body: {
      name: 'Australian Psychological Society (APS)',
      url: 'https://psychology.org.au',
      role: 'skills assessment of overseas psychology qualifications for migration',
    },
    also: [AHPRA('Psychology Board of Australia')],
    note: 'The APS assesses the qualification for migration; the Psychology Board registers psychologists through Ahpra.',
  },
  {
    id: 'speech-pathology',
    label: 'Speech pathology',
    keywords: ['speech'],
    body: {
      name: 'Speech Pathology Australia',
      url: 'https://www.speechpathologyaustralia.org.au',
      role: 'assessment of overseas speech pathology qualifications',
    },
    also: [],
    note: 'Speech pathology is self-regulated in Australia; membership follows the assessment.',
  },
  {
    id: 'dietetics',
    label: 'Dietetics and nutrition',
    keywords: ['dietet', 'nutrition'],
    body: {
      name: 'Dietitians Australia',
      url: 'https://dietitiansaustralia.org.au',
      role: 'assessment of overseas dietetics qualifications',
    },
    also: [],
    note: 'Dietitians Australia assesses the qualification and grants the Accredited Practising Dietitian credential.',
  },
  {
    id: 'medical-radiation',
    label: 'Medical radiation science',
    keywords: ['radiograph', 'radiation', 'sonograph', 'medical imaging'],
    body: {
      name: 'Australian Society of Medical Imaging and Radiation Therapy (ASMIRT)',
      url: 'https://www.asmirt.org',
      role: 'assessment of overseas medical radiation qualifications',
    },
    also: [AHPRA('Medical Radiation Practice Board of Australia')],
    note: 'ASMIRT assesses the qualification; the Medical Radiation Practice Board registers practitioners through Ahpra.',
  },
  {
    id: 'optometry',
    label: 'Optometry',
    keywords: ['optom'],
    body: {
      name: 'Optometry Council of Australia and New Zealand (OCANZ)',
      url: 'https://www.ocanz.org',
      role: 'assessment of overseas optometry qualifications',
    },
    also: [AHPRA('Optometry Board of Australia')],
    note: 'OCANZ assesses the qualification; the Optometry Board registers optometrists through Ahpra.',
  },
  {
    id: 'medical-laboratory',
    label: 'Medical laboratory science',
    keywords: ['laboratory', 'biomedical science', 'medical science', 'pathology'],
    body: {
      name: 'Australian Institute of Medical and Clinical Scientists (AIMS)',
      url: 'https://www.aims.org.au',
      role: 'skills assessment for medical laboratory scientists',
    },
    also: [],
    note: 'AIMS assesses overseas medical laboratory science qualifications for migration.',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    keywords: ['engineer'],
    body: {
      name: 'Engineers Australia',
      url: 'https://www.engineersaustralia.org.au',
      role: 'Migration Skills Assessment for engineers',
    },
    also: [],
    note: 'Engineers Australia assesses the qualification and experience; a Washington Accord degree is recognised outright, others go through a competency demonstration report.',
  },
  {
    id: 'accounting',
    label: 'Accounting',
    keywords: ['account', 'auditing', 'bookkeep', 'chartered'],
    body: {
      name: 'CPA Australia',
      url: 'https://www.cpaaustralia.com.au',
      role: 'migration skills assessment for accountants',
    },
    also: [
      {
        name: 'Chartered Accountants Australia and New Zealand (CA ANZ)',
        url: 'https://www.charteredaccountantsanz.com',
        role: 'migration skills assessment for accountants',
      },
      {
        name: 'Institute of Public Accountants (IPA)',
        url: 'https://www.publicaccountants.org.au',
        role: 'migration skills assessment for accountants',
      },
    ],
    note: 'Any of the three accounting bodies can assess the qualification; pick the one whose membership you want afterwards.',
  },
  {
    id: 'teaching',
    label: 'Teaching',
    keywords: ['teach', 'education', 'pedagog', 'early childhood', 'b.ed', 'm.ed'],
    body: {
      name: 'Australian Institute for Teaching and School Leadership (AITSL)',
      url: 'https://www.aitsl.edu.au',
      role: 'migration skills assessment for teachers',
    },
    also: [
      {
        name: 'Queensland College of Teachers',
        url: 'https://www.qct.edu.au',
        role: 'registration to teach in Queensland; each state and territory has its own regulator',
      },
    ],
    note: 'AITSL assesses the qualification for migration; to teach you register with the regulator in your state, which in Queensland is the Queensland College of Teachers.',
  },
  {
    id: 'social-work',
    label: 'Social work',
    keywords: ['social work'],
    body: {
      name: 'Australian Association of Social Workers (AASW)',
      url: 'https://www.aasw.asn.au',
      role: 'assessment of overseas social work qualifications',
    },
    also: [],
    note: 'The AASW assesses the qualification for migration and for eligibility to practise.',
  },
  {
    id: 'law',
    label: 'Law',
    keywords: ['law', 'legal', 'llb', 'juris', 'solicitor', 'barrister', 'attorney'],
    body: {
      name: 'Legal Practitioners Admissions Board (Queensland)',
      url: 'https://www.qls.com.au/Legal-Practitioners-Admissions-Board',
      role: 'assessment of overseas law qualifications for admission in Queensland',
    },
    also: [
      {
        name: 'Legal Profession Admission Board (New South Wales)',
        url: 'https://lpab.nsw.gov.au',
        role: 'assessment of overseas law qualifications for admission in New South Wales',
      },
    ],
    note: 'Admission is state by state; the admitting authority in the state where you want to practise assesses the degree and may set further subjects.',
  },
  {
    id: 'ict',
    label: 'Information technology',
    keywords: ['computer', 'software', 'software engineer', 'information technology', 'information systems', 'computing', 'informatics', 'data science', 'cyber', 'ict'],
    body: {
      name: 'Australian Computer Society (ACS)',
      url: 'https://www.acs.org.au',
      role: 'migration skills assessment for ICT professionals',
    },
    also: [],
    note: 'The ACS assesses ICT qualifications and work experience for migration.',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    keywords: ['architect'],
    body: {
      name: 'Architects Accreditation Council of Australia (AACA)',
      url: 'https://www.aaca.org.au',
      role: 'assessment of overseas architecture qualifications',
    },
    also: [],
    note: 'The AACA assesses the qualification; registration as an architect is with the board in your state.',
  },
  {
    id: 'veterinary',
    label: 'Veterinary science',
    keywords: ['veterinar'],
    body: {
      name: 'Australasian Veterinary Boards Council (AVBC)',
      url: 'https://avbc.asn.au',
      role: 'assessment of overseas veterinary qualifications',
    },
    also: [],
    note: 'The AVBC assesses the qualification; registration is with the veterinary board in your state.',
  },
  {
    id: 'trades',
    label: 'Trades',
    keywords: ['electric', 'plumb', 'carpent', 'chef', 'cook', 'hairdress', 'mechanic', 'weld', 'bricklay', 'fitter', 'boilermaker', 'pastry', 'baker', 'painter', 'tiler', 'cabinet', 'joiner', 'trade cert', 'apprentice'],
    body: {
      name: 'Trades Recognition Australia (TRA)',
      url: 'https://www.tradesrecognitionaustralia.gov.au',
      role: 'skills assessment for trade occupations',
    },
    also: [
      {
        name: 'VETASSESS',
        url: 'https://www.vetassess.com.au',
        role: 'skills assessment for some trade occupations',
      },
    ],
    note: 'Trades Recognition Australia assesses most trades; a licensed trade such as electrical or plumbing also needs a licence from the regulator in your state.',
  },
];

/** Where everything else goes: the general assessor and the qualification comparison service. */
export const GENERAL_PATHWAY: ProfessionPathway = {
  id: 'general',
  label: 'Other professions',
  keywords: [],
  body: {
    name: 'VETASSESS',
    url: 'https://www.vetassess.com.au',
    role: 'skills assessment for most professional occupations not covered by a specialist body',
  },
  also: [
    {
      name: 'Department of Education qualifications recognition (formerly AEI-NOOSR)',
      url: 'https://www.education.gov.au/qualifications-recognition',
      role: 'how an overseas qualification compares with the Australian Qualifications Framework',
    },
  ],
  note: 'No specialist body covers this field. VETASSESS assesses most general professions, and the Department of Education can say how the qualification compares with an Australian one.',
};

export interface PathwaySuggestion {
  /** True when a keyword matched; false means the general pathway is offered. */
  matched: boolean;
  profession: { id: string; label: string };
  body: AssessingBody;
  also: AssessingBody[];
  note: string;
  /** The words a bridging program's profession is matched on. */
  bridgingKeywords: string[];
}

const normalise = (value: unknown): string => (typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, ' ').trim() : '');

/**
 * A keyword matches at the start of a word ("nurs" finds "Nursing", "ict"
 * finds "ICT" but not "architecture"), and a two-word keyword outweighs a
 * one-word one, so "medical imaging" beats a lone "medical".
 */
function score(entry: ProfessionPathway, text: string): number {
  let total = 0;
  for (const keyword of entry.keywords) {
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    if (pattern.test(text)) total += keyword.split(' ').length;
  }
  return total;
}

/**
 * The pathway that fits a credential, from the words in its field of study
 * and its name. The entry with the highest keyword score wins; a tie goes to
 * the earlier entry in the table.
 */
export function suggestPathway(input: { fieldOfStudy?: string | null; credentialName?: string | null }): PathwaySuggestion {
  const text = `${normalise(input.fieldOfStudy)} ${normalise(input.credentialName)}`.trim();
  let best: { entry: ProfessionPathway; hits: number } | null = null;
  if (text) {
    for (const entry of PROFESSION_PATHWAYS) {
      const hits = score(entry, text);
      if (hits > 0 && (!best || hits > best.hits)) best = { entry, hits };
    }
  }
  const entry = best?.entry ?? GENERAL_PATHWAY;
  return {
    matched: Boolean(best),
    profession: { id: entry.id, label: entry.label },
    body: entry.body,
    also: entry.also,
    note: entry.note,
    bridgingKeywords: best ? bridgingKeywordsFor(entry) : [],
  };
}

/** The fragments a bridging program's `profession` is matched on, case-insensitively. */
export function bridgingKeywordsFor(entry: ProfessionPathway): string[] {
  const fromLabel = entry.label
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && w !== 'and' && w !== 'science');
  return Array.from(new Set([entry.id, ...fromLabel, ...entry.keywords.filter((k) => k.length > 3)]));
}

/** The table as the public endpoint and the admin queue show it. */
export function listAssessingBodies(): Array<{ profession: { id: string; label: string }; body: AssessingBody; also: AssessingBody[]; note: string }> {
  return [...PROFESSION_PATHWAYS, GENERAL_PATHWAY].map((p) => ({
    profession: { id: p.id, label: p.label },
    body: p.body,
    also: p.also,
    note: p.note,
  }));
}

// ------------------------------------------------------------ English support

export interface EnglishSupport {
  name: string;
  shortName: string;
  provider: string;
  cost: string;
  url: string;
  summary: string;
  eligibility: string;
  /** The proficiency it was suggested for. */
  forProficiency: string;
}

/**
 * The Adult Migrant English Program is the Commonwealth's free English
 * tuition for eligible migrants and humanitarian entrants who do not yet
 * have vocational English. It is the one ESL recommendation the platform
 * can make without a course partner, so it is shown whenever a member's
 * English is below that level.
 */
export const AMEP = {
  name: 'Adult Migrant English Program',
  shortName: 'AMEP',
  provider: 'Australian Government, Department of Home Affairs',
  cost: 'Free',
  url: 'https://immi.homeaffairs.gov.au/settling-in-australia/amep/about-the-program',
  summary: 'Free English classes for eligible migrants and humanitarian entrants, in person or online, through local providers such as TAFEs and community colleges.',
  eligibility: 'You need to hold an eligible visa and not yet have vocational-level English. The provider checks eligibility when you register.',
};

/** The proficiencies below vocational English, where AMEP applies. */
export const ENGLISH_SUPPORT_LEVELS: ReadonlySet<string> = new Set(['NONE', 'BEGINNER', 'INTERMEDIATE']);

export function englishSupportFor(proficiency: string | null | undefined): EnglishSupport | null {
  if (!proficiency || !ENGLISH_SUPPORT_LEVELS.has(proficiency)) return null;
  return { ...AMEP, forProficiency: proficiency };
}
