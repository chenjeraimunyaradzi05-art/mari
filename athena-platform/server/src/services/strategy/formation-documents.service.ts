/**
 * The documents a registration needs, generated from what the member has
 * entered: the "legal document generation" step of the Formation Studio.
 *
 * Nothing here is drafted by a model. Each document is a template with
 * the registration's own names, addresses and numbers written in, and
 * square-bracketed gaps where something is still to be decided. A
 * partnership agreement or a company resolution produced this way is the
 * ordinary starting point an accountant or lawyer works from; the trust
 * deed itself is deliberately not produced, because it has to be drawn
 * and executed properly, so the trust document is instructions for the
 * solicitor instead.
 */

export interface RegistrationLike {
  type: string;
  businessName?: string | null;
  abn?: string | null;
  acn?: string | null;
  data?: unknown;
}

export interface FormationDocument {
  key: string;
  title: string;
  purpose: string;
  content: string;
}

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const names = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => (typeof x === 'string' ? x : text(record(x).name))).map((s) => s.trim()).filter(Boolean)
    : [];
const GAP = (what: string) => `[${what}]`;

function address(data: Record<string, unknown>): string {
  const a = record(data.registeredAddress ?? data.businessAddress ?? data.principalPlaceOfBusiness ?? data.address);
  const parts = [text(a.line1), text(a.city), [text(a.state), text(a.postcode)].filter(Boolean).join(' '), text(a.country)].filter(Boolean);
  return parts.length ? parts.join(', ') : GAP('registered address');
}

function stateOf(data: Record<string, unknown>): string {
  const a = record(data.registeredAddress ?? data.businessAddress ?? data.address);
  return text(a.state, 'Queensland');
}

const signatureBlock = (people: string[]) => people.map((p) => `\n\n______________________________\n${p}\nDate: ____ / ____ / ________`).join('\n');
const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
const fmtDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

function startingChecklist(reg: RegistrationLike, data: Record<string, unknown>, now: Date): FormationDocument {
  const name = text(reg.businessName, GAP('business name'));
  const label = { SOLE_TRADER: 'a sole trader', PARTNERSHIP: 'a partnership', COMPANY: 'a company', TRUST: 'a trust' }[reg.type] ?? 'a business';
  const items = [
    `Apply for an ABN for ${name} as ${label} at abr.gov.au. ${reg.abn ? `ABN on file: ${reg.abn}.` : 'It is free and usually issued the same day.'}`,
    reg.type === 'SOLE_TRADER' ? 'Your own tax file number covers the business; nothing more to register for tax unless you go over $75,000 in sales.' : 'Apply for a tax file number for the entity at the same time as the ABN; it lodges its own return.',
    `Register the business name with ASIC if you trade under anything other than ${reg.type === 'COMPANY' ? 'the company name' : 'your own name'}: one year or three, renewed after.`,
    reg.type === 'COMPANY' ? `Register the company with ASIC (Form 201, about $600). ${reg.acn ? `ACN on file: ${reg.acn}.` : 'The ACN comes back within a day; the ABN is applied for against it.'}` : '',
    'Register for GST once sales reach $75,000 in a year, or from the start if you want to claim GST on set-up costs. Then a BAS each quarter.',
    'Register for PAYG withholding before the first pay run if you employ anyone, and for workers compensation in your state.',
    'Open a separate bank account for the business, even as a sole trader. Every record-keeping problem starts with a shared account.',
    'Buy the domain and set up an email address on it before the business name is public.',
    'Put accounting software on from the first invoice. The bank feed in ATHENA posts to the ledger and works the BAS out from it.',
    'Public liability insurance if anyone visits you or you visit them; professional indemnity if you give advice; both before the first client.',
    'Terms of trade, a privacy policy if you collect details online, and an invoice template that says "Tax invoice" and carries the ABN.',
    `Work out the quarterly set-aside in the tax plan so the first BAS and income tax bill are already in the bank.`,
  ].filter(Boolean);
  return {
    key: 'getting-started',
    title: 'Getting started checklist',
    purpose: 'Every registration and set-up step, in order, with where each is done.',
    content: `# ${name}: getting started\n\nPrepared ${fmtDate(now)} for ${label}${data.state ? ` in ${text(data.state)}` : ''}.\n\n${items.map((i, n) => `${n + 1}. ${i}`).join('\n')}\n\nSources: Australian Business Register (abr.gov.au), ASIC Connect (asic.gov.au), ATO (ato.gov.au). Fees and thresholds are as at ${now.getFullYear()}; check them when you apply.\n`,
  };
}

function recordKeeping(reg: RegistrationLike, now: Date): FormationDocument {
  return {
    key: 'record-keeping',
    title: 'Record-keeping and set-aside guide',
    purpose: 'What to keep, for how long, and what to move aside each time money comes in.',
    content: `# Records and set-aside for ${text(reg.businessName, GAP('business name'))}\n\nPrepared ${fmtDate(now)}.\n\n## Keep, for five years\n${list([
      'Every invoice you issue and every receipt for an expense, as a photo or a PDF the day you get it.',
      'Bank statements for the business account, and a note beside any private spend that slipped in.',
      'A log of work kilometres if you claim the car, and a diary of hours if you claim working from home.',
      'Contracts, quotes and the terms each client agreed to.',
      'If you employ: pay records, super payments and the hours worked.',
    ])}\n\n## Set aside, every time you are paid\n${list([
      'Income tax at the rate the tax plan works out for your profit, into an account you do not spend from.',
      'GST collected (one eleventh of a taxable sale) once registered; it was never yours.',
      'Super for yourself at 12% if you can; nobody else will pay it, and it is deductible.',
    ])}\n\n## Each quarter\n${list([
      'Lodge the BAS if registered for GST; the ATHENA worksheet counts it from the ledger.',
      'Pay the PAYG instalment the ATO asks for after your first return.',
      'Reconcile the bank feed and post the lines to the ledger.',
    ])}\n`,
  };
}

function partnershipAgreement(reg: RegistrationLike, data: Record<string, unknown>, now: Date): FormationDocument {
  const partners = names(data.partners);
  const people = partners.length ? partners : [GAP('partner 1'), GAP('partner 2')];
  const name = text(reg.businessName, GAP('partnership name'));
  const share = (100 / people.length).toFixed(people.length === 3 ? 1 : 0);
  return {
    key: 'partnership-agreement',
    title: 'Partnership agreement (draft)',
    purpose: 'The terms partners agree before trading. A draft to take to a lawyer, not a substitute for one.',
    content: `# Partnership agreement\n\n**${name}**\n\nMade on ${fmtDate(now)} between:\n${people.map((p, i) => `${i + 1}. ${p} of ${GAP('address')}`).join('\n')}\n\n(together, the Partners).\n\n## 1. The partnership\nThe Partners carry on the business of ${GAP('what the business does')} in partnership under the name ${name}, from ${GAP('start date')}, from ${address(data)}.\n\n## 2. Capital\nEach Partner contributes the capital set out here, and further capital only as all Partners agree in writing:\n${people.map((p) => `- ${p}: $${GAP('amount')}`).join('\n')}\n\n## 3. Profits and losses\nProfits and losses are shared ${people.map((p) => `${p} ${share}%`).join(', ')}, unless the Partners agree another split in writing before the start of a financial year.\n\n## 4. Drawings\nEach Partner may draw up to $${GAP('amount')} a month against her share of profit. Drawings above that need every Partner's agreement.\n\n## 5. Decisions\nDay-to-day decisions are made by any Partner. These need every Partner's agreement: borrowing over $${GAP('amount')}, signing a lease, hiring or dismissing staff, admitting a new partner, changing what the business does, and spending over $${GAP('amount')} outside the budget.\n\n## 6. Duties\nEach Partner gives the time and attention the business needs, acts in good faith toward the others, and does not compete with the partnership while a Partner or for ${GAP('months')} months after leaving.\n\n## 7. Books and bank\nThe partnership keeps proper books, holds a bank account in its name operated by ${GAP('which signatures')}, and has its accounts prepared each financial year.\n\n## 8. Leaving, death and incapacity\nA Partner may leave on ${GAP('months')} months' written notice. On leaving, death or incapacity the remaining Partners may buy that Partner's share at a value agreed or fixed by an independent accountant, paid over ${GAP('months')} months.\n\n## 9. Disputes\nA dispute goes first to a meeting of the Partners, then to mediation, before any court.\n\n## 10. Law\nThis agreement is governed by the law of ${stateOf(data)}.\n\n## Signed by the Partners${signatureBlock(people)}\n\n---\n*Generated by ATHENA from the registration on ${fmtDate(now)}. Square brackets mark what is still to be decided. Have a lawyer review before signing; partners are each liable for the whole of the partnership's debts.*\n`,
  };
}

function directorConsents(reg: RegistrationLike, data: Record<string, unknown>, now: Date): FormationDocument {
  const directors = names(data.directors);
  const people = directors.length ? directors : [GAP('director')];
  const name = text(reg.businessName, GAP('company name'));
  const consents = people.map((d) => `## Consent to act as director\n\nI, ${d}, of ${GAP('residential address')}, born ${GAP('date of birth')} at ${GAP('place of birth')}, consent to act as a director of **${name}**${reg.acn ? ` (ACN ${reg.acn})` : ''} and confirm that I am not disqualified from managing a corporation under the Corporations Act 2001. I will apply for a director identification number before appointment if I do not hold one.\n\n______________________________\n${d}\nDate: ____ / ____ / ________\n`).join('\n');
  return {
    key: 'director-consents',
    title: 'Consent to act as director',
    purpose: 'Each director signs one before the company is registered; ASIC requires the company to hold them.',
    content: `# ${name}: director consents\n\n${consents}\n---\n*Section 201D of the Corporations Act requires a signed consent from each director before appointment. Keep the originals with the company's records. Every director needs a director ID from abrs.gov.au.*\n`,
  };
}

function firstResolution(reg: RegistrationLike, data: Record<string, unknown>, now: Date): FormationDocument {
  const directors = names(data.directors);
  const people = directors.length ? directors : [GAP('director')];
  const shareholders = names(data.shareholders);
  const holders = shareholders.length ? shareholders : people;
  const name = text(reg.businessName, GAP('company name'));
  return {
    key: 'first-resolution',
    title: "First directors' resolution",
    purpose: 'The decisions a new company records on day one: office, shares, rules, bank and registrations.',
    content: `# ${name}${reg.acn ? ` (ACN ${reg.acn})` : ''}\n\n## Resolutions of the directors\n\nPassed on ${GAP('date')} by ${people.join(', ')}.\n\n1. **Registration.** The certificate of registration issued by ASIC is noted and is to be kept with the company's records.\n2. **Directors.** ${people.join(', ')} ${people.length === 1 ? 'is' : 'are'} the director${people.length === 1 ? '' : 's'} of the company, each having consented in writing.\n3. **Registered office.** The registered office is ${address(data)}${GAP('the occupier has consented in writing if the company does not occupy it')}.\n4. **Principal place of business.** ${address(data)}.\n5. **Shares.** The following shares are issued at $1.00 each, fully paid, and the share register is to record them:\n${holders.map((h) => `   - ${h}: ${GAP('number')} ordinary shares`).join('\n')}\n6. **Rules.** The company is governed by the replaceable rules in the Corporations Act${people.length === 1 && holders.length === 1 ? ' (as a company with a sole director who is also the sole shareholder, no constitution is required)' : ', until a constitution is adopted'}.\n7. **Bank.** A bank account is to be opened in the company's name, operated by ${GAP('which directors')}.\n8. **Registrations.** The company is to apply for an ABN and a tax file number, and for GST registration ${GAP('now, or once sales reach $75,000')}.\n9. **Records.** The company secretary (or a director) is to keep the registers, minutes and financial records the Act requires.\n\n${signatureBlock(people)}\n\n---\n*Generated by ATHENA from the registration on ${fmtDate(now)}. The company must also pay the ASIC annual review fee each year and keep its details current on the register.*\n`,
  };
}

function constitutionNote(reg: RegistrationLike, data: Record<string, unknown>, now: Date): FormationDocument {
  const directors = names(data.directors);
  return {
    key: 'constitution-note',
    title: 'Constitution, or the replaceable rules',
    purpose: 'Whether the company needs its own constitution, and what the replaceable rules already cover.',
    content: `# ${text(reg.businessName, GAP('company name'))}: the rules the company runs by\n\nPrepared ${fmtDate(now)}.\n\nA company can adopt its own constitution or rely on the replaceable rules in the Corporations Act. ${directors.length <= 1 ? 'With one director who is also the only shareholder, the Act supplies the rules and no constitution is needed until other people are involved.' : 'With more than one director or shareholder, a short constitution is worth having, because the replaceable rules say nothing about what happens when the owners disagree.'}\n\n## What the replaceable rules cover\n${list([
      'How directors are appointed and removed, and that directors decide by majority.',
      'How meetings of members are called and run.',
      'That shares are transferred by a signed transfer, and directors may refuse to register one.',
      'Dividends as the directors decide, paid in proportion to shares.',
    ])}\n\n## What a constitution adds when there is more than one owner\n${list([
      'Pre-emptive rights: an owner who sells offers her shares to the others first.',
      'What happens on death, disability or a falling-out: a forced sale at an agreed valuation method.',
      'Which decisions need every shareholder, not just a majority.',
      'How a new investor comes in and what dilution the founders accept.',
      'A shareholders\' agreement covers the same ground privately; a constitution is lodged with ASIC.',
    ])}\n\n*A lawyer drafts the constitution or shareholders' agreement; this note is the brief to give them.*\n`,
  };
}

function trustInstructions(reg: RegistrationLike, data: Record<string, unknown>, now: Date): FormationDocument {
  const trustees = names(data.trustees);
  const people = trustees.length ? trustees : [GAP('trustee')];
  const name = text(reg.businessName, GAP('trust name'));
  return {
    key: 'trust-deed-instructions',
    title: 'Trust deed: instructions for the solicitor',
    purpose: 'Everything the deed drafter needs, decided in advance so the deed is right the first time.',
    content: `# ${name}: instructions for the trust deed\n\nPrepared ${fmtDate(now)}.\n\n| Item | Instruction |\n|---|---|\n| Name of the trust | ${name} |\n| Type | Discretionary (family) trust |\n| Settlor | ${GAP('a person who is not a beneficiary and never will be, such as an accountant or a friend')} |\n| Settled sum | $10, paid by the settlor and never returned |\n| Trustee${people.length === 1 ? '' : 's'} | ${people.join(', ')} ${GAP('or a corporate trustee company, which most advisers recommend for asset protection')} |\n| Appointor | ${GAP('who can remove and replace the trustee; usually the founder, with a successor named')} |\n| Primary beneficiaries | ${GAP('names')} |\n| General beneficiaries | The spouses, children, grandchildren, siblings and parents of the primary beneficiaries, and any company or trust in which they hold an interest |\n| Excluded | The settlor, and any foreign person if the trust may hold residential land in NSW, VIC or QLD |\n| Vesting date | 80 years from the date of the deed |\n| Powers | Full powers to carry on a business, borrow, invest, distribute income and capital separately, and stream franked dividends and capital gains |\n| Financial year | 1 July to 30 June |\n| Governing law | ${stateOf(data)} |\n\n## After the deed is signed\n${list([
      'Stamp the deed where the state requires it: NSW, VIC, TAS and the NT charge duty within a set period after signing; QLD, SA, WA and the ACT do not.',
      'Apply for the trust\'s ABN and tax file number, with the trustee as the applicant.',
      'Open a bank account in the trustee\'s name as trustee for the trust.',
      'Record the first trustee resolution accepting the appointment and the settled sum.',
      'Each June, resolve how the year\'s income is distributed before 30 June; undistributed income is taxed at the top rate.',
    ])}\n\n---\n*ATHENA does not draw the deed: it has to be prepared and executed properly to be valid. Take this sheet to a solicitor or an accountant who orders deeds; the cost is usually $500 to $1,500 for the deed and more for a corporate trustee.*\n`,
  };
}

function trusteeResolution(reg: RegistrationLike, data: Record<string, unknown>, now: Date): FormationDocument {
  const trustees = names(data.trustees);
  const people = trustees.length ? trustees : [GAP('trustee')];
  return {
    key: 'trustee-resolution',
    title: "Trustee's first resolution",
    purpose: 'The record the trustee makes on accepting the trust.',
    content: `# ${text(reg.businessName, GAP('trust name'))}\n\n## Resolution of the trustee\n\nMade on ${GAP('date')} by ${people.join(', ')}.\n\n1. The trustee accepts appointment as trustee of the trust under the deed dated ${GAP('date of deed')}.\n2. The settled sum of $10 has been received from the settlor and is held on the terms of the deed.\n3. The trustee will apply for an ABN and a tax file number for the trust and open a bank account in its name as trustee.\n4. The trust's financial year ends 30 June, and the trustee will resolve on the distribution of each year's income before that date.\n5. The trustee will keep minutes, accounts and a register of beneficiaries' entitlements.\n${signatureBlock(people)}\n\n---\n*Generated by ATHENA from the registration on ${fmtDate(now)}.*\n`,
  };
}

/** The documents this registration needs, with its details written in. */
export function generateFormationDocuments(reg: RegistrationLike, now = new Date()): FormationDocument[] {
  const data = record(reg.data);
  const common = [startingChecklist(reg, data, now)];
  switch (reg.type) {
    case 'SOLE_TRADER':
      return [...common, recordKeeping(reg, now)];
    case 'PARTNERSHIP':
      return [...common, partnershipAgreement(reg, data, now), recordKeeping(reg, now)];
    case 'COMPANY':
      return [...common, directorConsents(reg, data, now), firstResolution(reg, data, now), constitutionNote(reg, data, now)];
    case 'TRUST':
      return [...common, trustInstructions(reg, data, now), trusteeResolution(reg, data, now)];
    default:
      return common;
  }
}

export const DOCUMENT_KEYS = ['getting-started', 'record-keeping', 'partnership-agreement', 'director-consents', 'first-resolution', 'constitution-note', 'trust-deed-instructions', 'trustee-resolution'] as const;
