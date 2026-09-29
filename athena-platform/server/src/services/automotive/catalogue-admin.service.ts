/**
 * The new-car catalogue as something the team keeps, not something only a
 * deploy can change.
 *
 * Every figure a member reads on a new-car page — the price, the ANCAP stars
 * and the year they were given, the consumption, the warranty, what servicing
 * costs — used to be a TypeScript literal in automotive-library, written into
 * CarModel by an upsert on every boot. There was no other way in: repricing one
 * car, adding a model or recording a new ANCAP result was a code change, a
 * review and a deploy, and the ANCAP years in particular are shown to women as
 * safety guidance. Nothing kept them true, so they would have rotted in place,
 * with the lapsed-rating logic working from years nobody had looked at again.
 *
 * What is here is the part of keeping them that does not need the database:
 * what a catalogue row may hold and the rules across its fields, what changed
 * between two versions of a row, the CSV the team can export, edit in a
 * spreadsheet and import again, the plan an import would carry out, and — from
 * the audit trail — when each row was last checked and by whom. The routes
 * that use it are the /admin/catalogue ones in automotive.routes.
 *
 * Two rules hold everywhere a row is written:
 *
 * - A change to a figure carries an "as at". Members read that line next to
 *   the figures; a new price under the old line would tell her it was checked
 *   when it was not. The admin form fills it with today's date for her to
 *   confirm, and a request that changes a figure without one is refused.
 *
 * - A slug never changes and a row is never deleted. The slug is the address
 *   of the car's page, which members have bookmarked and garages link to, and
 *   the starter list is created by slug: a renamed or deleted row would be
 *   created again from the starter list on the next boot. Taking a car out of
 *   the catalogue is retiring it (isActive false), which keeps its reviews and
 *   every garage that points at it.
 */

import { z } from 'zod';
import type { CarModel } from '@prisma/client';
import { isHttpUrl } from '../../utils/http-url';
import { ANCAP_VALID_YEARS, BODY_TYPES, FUEL_TYPES, SAFETY_FEATURES, ancapStatus, type BodyKey, type FuelKey } from './automotive-library';

// ------------------------------------------------------------------ fields

const BODY_KEYS = BODY_TYPES.map((b) => b.key) as [BodyKey, ...BodyKey[]];
const FUEL_KEYS = FUEL_TYPES.map((f) => f.key) as [FuelKey, ...FuelKey[]];
const SAFETY_KEYS: ReadonlySet<string> = new Set(SAFETY_FEATURES.map((f) => f.key));

/**
 * The separator for the two list columns in the CSV. A highlight may hold a
 * comma or a semicolon ("Seven seats (the last two are small) at a five-seat
 * price"), so the list is split on a character no highlight is allowed to
 * contain, which is what makes an export import back unchanged.
 */
export const LIST_SEPARATOR = '|';

/** An empty field in the form or an empty CSV cell is "not published", never zero. */
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const number = () => z.coerce.number({ invalid_type_error: 'a number' });
const whole = (min: number, max: number) => number().int('a whole number').min(min).max(max);
const wholeOrNull = (min: number, max: number) => z.preprocess(blankToNull, whole(min, max).nullable());
const decimalOrNull = (min: number, max: number) => z.preprocess(blankToNull, number().min(min).max(max).nullable());

/**
 * Every field an admin maintains on a catalogue row, with the ranges a real
 * car falls in. The ranges are there to catch a slip of the keyboard — a price
 * of 32 instead of 32,000, a warranty of 70 years — not to second-guess an
 * unusual car, so they are wide.
 */
export const catalogueFields = {
  make: z.string().trim().min(1, 'the make').max(40),
  model: z.string().trim().min(1, 'the model').max(60),
  variant: z.preprocess(blankToNull, z.string().trim().max(80).nullable()),
  year: whole(1990, 2100),
  bodyType: z.enum(BODY_KEYS),
  fuelType: z.enum(FUEL_KEYS),
  transmission: z.enum(['AUTOMATIC', 'MANUAL']),
  seats: whole(1, 12),
  priceFrom: whole(1_000, 2_000_000),
  ancapStars: wholeOrNull(0, 5),
  ancapYear: wholeOrNull(1993, 2100),
  fuelPer100: decimalOrNull(0, 40),
  kwhPer100: decimalOrNull(0, 60),
  rangeKm: wholeOrNull(0, 2_000),
  co2GramsKm: wholeOrNull(0, 700),
  warrantyYears: wholeOrNull(0, 20),
  warrantyKm: wholeOrNull(0, 1_000_000),
  serviceIntervalMonths: wholeOrNull(1, 48),
  serviceIntervalKm: wholeOrNull(1_000, 100_000),
  servicingCostYear: wholeOrNull(0, 20_000),
  safetyFeatures: z.array(z.string().trim()).max(SAFETY_FEATURES.length)
    .refine((keys) => keys.every((k) => SAFETY_KEYS.has(k)), { message: `use the keys from the safety guide (${[...SAFETY_KEYS].join(', ')})` })
    .transform((keys) => [...new Set(keys)]),
  highlights: z.array(z.string().trim().min(1).max(140).refine((h) => !h.includes(LIST_SEPARATOR), `a highlight cannot contain "${LIST_SEPARATOR}"`)).max(6),
  sourceUrl: z.preprocess(blankToNull, z.string().trim().max(500).refine(isHttpUrl, 'an http or https link').nullable()),
  asAt: z.string().trim().min(3, 'say when and against what these figures were checked').max(160),
};

export type CatalogueFields = { [K in keyof typeof catalogueFields]: z.output<(typeof catalogueFields)[K]> };
export type CatalogueKey = keyof CatalogueFields;
export const CATALOGUE_KEYS = Object.keys(catalogueFields) as CatalogueKey[];

/** A slug: lower case words joined by hyphens, the shape every starter row already has. */
export const slugSchema = z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');

export const catalogueCreateSchema = z.object({ ...catalogueFields, slug: slugSchema.optional(), isActive: z.boolean().optional() });
export const cataloguePatchSchema = z.object(catalogueFields).partial().extend({ isActive: z.boolean().optional() });
export const catalogueCheckedSchema = z.object({ asAt: catalogueFields.asAt, sourceUrl: catalogueFields.sourceUrl.optional() });

export type CatalogueCreate = z.output<typeof catalogueCreateSchema>;
export type CataloguePatch = z.output<typeof cataloguePatchSchema>;

/**
 * The fields that are words about the row rather than claims about the car.
 * Changing only these does not need a fresh "as at"; changing anything else
 * does, because the as-at is what qualifies it.
 */
const NOT_FIGURES: ReadonlySet<CatalogueKey | 'isActive'> = new Set(['make', 'model', 'highlights', 'sourceUrl', 'asAt', 'isActive']);

export function changesFigures(changes: Record<string, unknown>): boolean {
  return Object.keys(changes).some((k) => !NOT_FIGURES.has(k as CatalogueKey));
}

/** The address a new row gets when the admin does not choose one. */
export function catalogueSlug(make: string, model: string, variant?: string | null): string {
  const words = [make, model, variant ?? ''].join(' ').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return words.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

/**
 * The rules across fields, checked on the row as it would stand after the
 * change — so a patch that only turns a petrol car electric is caught by the
 * fuel figure it left behind.
 *
 * Each one guards something a member reads. A star count without a year is
 * the exact thing this vertical promises never to show; a rating from the
 * future is a typo that would read as current for six extra years; an
 * electric car with a litres figure prints "L/100 km" on a car with no tank.
 */
export function crossFieldProblem(row: CatalogueFields, now = new Date()): string | null {
  const thisYear = now.getFullYear();
  if ((row.ancapStars === null) !== (row.ancapYear === null)) return 'ANCAP stars and the year of the test go together: give both, or neither for a car ANCAP has not rated';
  if (row.ancapYear !== null && row.ancapYear > thisYear) return `The ANCAP year cannot be later than ${thisYear}`;
  if (row.year > thisYear + 2) return `The model year cannot be later than ${thisYear + 2}`;
  if (row.fuelType === 'ELECTRIC' && row.fuelPer100 !== null) return 'An electric car uses no fuel: put its energy use in kWh per 100 km and leave litres empty';
  if ((row.fuelType === 'PETROL' || row.fuelType === 'DIESEL' || row.fuelType === 'HYBRID') && row.kwhPer100 !== null) return 'Only an electric car or a plug-in hybrid has a kWh per 100 km figure';
  if (row.warrantyYears === null && row.warrantyKm !== null) return 'A warranty distance needs the years it runs for';
  return null;
}

/**
 * A row with a patch laid over it. zod hands back a key the request carried
 * as undefined, and a plain spread would write that undefined over the
 * stored value; here it leaves the field as it was.
 */
export function mergeFields(before: CatalogueFields, patch: Partial<CatalogueFields>): CatalogueFields {
  const out: Record<string, unknown> = { ...before };
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) out[key] = value;
  return out as CatalogueFields;
}

/** A catalogue row as the fields above, the shape a diff and a merge work in. */
export function fieldsOf(row: CarModel): CatalogueFields {
  const dec = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));
  return {
    make: row.make, model: row.model, variant: row.variant, year: row.year, bodyType: row.bodyType as BodyKey, fuelType: row.fuelType as FuelKey, transmission: row.transmission, seats: row.seats, priceFrom: row.priceFrom,
    ancapStars: row.ancapStars, ancapYear: row.ancapYear, fuelPer100: dec(row.fuelPer100), kwhPer100: dec(row.kwhPer100), rangeKm: row.rangeKm, co2GramsKm: row.co2GramsKm, warrantyYears: row.warrantyYears, warrantyKm: row.warrantyKm,
    serviceIntervalMonths: row.serviceIntervalMonths, serviceIntervalKm: row.serviceIntervalKm, servicingCostYear: row.servicingCostYear, safetyFeatures: [...row.safetyFeatures], highlights: [...row.highlights], sourceUrl: row.sourceUrl, asAt: row.asAt ?? '',
  };
}

const same = (a: unknown, b: unknown): boolean => (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : a === b);

export type FieldChange = { from: unknown; to: unknown };

/**
 * What a patch would actually change, field by field, leaving out anything it
 * restates. It is what the audit row records and what an import preview
 * shows, so "updated" always comes with the before and the after.
 */
export function diffCatalogue(before: CatalogueFields & { isActive: boolean }, patch: Partial<CatalogueFields> & { isActive?: boolean }): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const [key, to] of Object.entries(patch)) {
    if (to === undefined) continue;
    const from = (before as Record<string, unknown>)[key];
    if (!same(from, to)) out[key] = { from, to };
  }
  return out;
}

// --------------------------------------------------------------------- CSV

/** The columns an export writes and an import reads, in the order a spreadsheet shows them. */
export const CATALOGUE_CSV_COLUMNS = ['slug', ...CATALOGUE_KEYS, 'isActive'] as const;
type CsvColumn = (typeof CATALOGUE_CSV_COLUMNS)[number];
const LIST_COLUMNS: ReadonlySet<string> = new Set(['safetyFeatures', 'highlights']);

/** The most rows one import may carry; the catalogue is a few dozen cars, and a file far past that is the wrong file. */
export const MAX_IMPORT_ROWS = 500;

/**
 * A cell a spreadsheet would run as a formula. Exports go straight into Excel
 * or Sheets, and a highlight beginning "=HYPERLINK(" is a formula there, not
 * words; OWASP's advice is a leading apostrophe, which the spreadsheet hides
 * and which the import takes off again so the text comes back as it went out.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell, quoted when it has to be and never readable as a formula. The referral ledger's export uses it too. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole catalogue as a CSV an admin can open, correct and import again. */
export function catalogueToCsv(rows: CarModel[]): string {
  const lines = [CATALOGUE_CSV_COLUMNS.join(',')];
  for (const row of rows) {
    const f = fieldsOf(row);
    const cells = CATALOGUE_CSV_COLUMNS.map((col) => {
      if (col === 'slug') return csvCell(row.slug);
      if (col === 'isActive') return row.isActive ? 'yes' : 'no';
      const v = f[col];
      return Array.isArray(v) ? csvCell(v.join(` ${LIST_SEPARATOR} `)) : csvCell(v);
    });
    lines.push(cells.join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export type CsvRecord = { line: number; cells: string[] };

/**
 * RFC 4180, which is what Excel, Numbers and Sheets write: commas, double
 * quotes around a cell that holds a comma, a quote or a line break, a quote
 * inside one doubled, and CRLF or LF between records. A byte-order mark at the
 * front is dropped. `line` is where each record starts in the file, so an
 * error can point at the line the admin sees in a text editor even when a
 * quoted cell spans several.
 */
export function parseCsv(input: string): { records: CsvRecord[]; error: string | null } {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  let i = 0;
  const endRecord = () => {
    cells.push(cell);
    // A blank line, or a row of empty cells a spreadsheet leaves at the end
    // of a sheet, is not a record.
    if (!cells.every((c) => c.trim() === '')) records.push({ line: start, cells });
    cells = [];
    cell = '';
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      if (ch === '\n') line += 1;
      cell += ch; i += 1; continue;
    }
    if (ch === '"' && cell === '') { quoted = true; i += 1; continue; }
    if (ch === ',') { cells.push(cell); cell = ''; i += 1; continue; }
    if (ch === '\r' || ch === '\n') {
      endRecord();
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      line += 1;
      start = line;
      continue;
    }
    cell += ch; i += 1;
  }
  if (quoted) return { records, error: `A quoted cell that starts on line ${start} is never closed` };
  if (cell !== '' || cells.length > 0) endRecord();
  return { records, error: null };
}

/** A cell as the value its column holds, before the schema sees it. */
function cellValue(column: CsvColumn, raw: string): unknown {
  const text = raw.startsWith("'") && FORMULA_START.test(raw.slice(1)) ? raw.slice(1) : raw;
  if (LIST_COLUMNS.has(column)) return text.split(LIST_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  return text.trim();
}

function yesNo(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(v)) return true;
  if (['no', 'n', 'false', '0'].includes(v)) return false;
  return null;
}

// ------------------------------------------------------------------ import

export type ImportProblem = { line: number; slug: string | null; message: string };
export type ImportCreate = { line: number; slug: string; data: CatalogueFields & { isActive: boolean } };
export type ImportUpdate = { line: number; slug: string; id: string; changes: Record<string, FieldChange>; patch: Partial<CatalogueFields> & { isActive?: boolean } };
export type ImportPlan = { columns: string[]; creates: ImportCreate[]; updates: ImportUpdate[]; unchanged: number; warnings: ImportProblem[]; errors: ImportProblem[] };

const issueWords = (error: z.ZodError): string => {
  const issue = error.issues[0];
  return issue ? `${issue.path.join('.') || 'row'}: ${issue.message}` : 'That row is not valid';
};

/**
 * What an import would do, worked out in full before anything is written.
 *
 * The file may carry every column or only some: `slug,priceFrom,asAt` is a
 * repricing, and the columns it leaves out are left alone. A column that is
 * there and empty means "not published" (null), which is how a figure is
 * cleared. A slug the catalogue does not have is a new car and needs every
 * required column. Nothing here touches the database, so the same plan is the
 * admin's preview and, recomputed against the rows as they stand at the time,
 * what an apply carries out.
 */
export function planCatalogueImport(csv: string, existing: CarModel[], now = new Date()): ImportPlan {
  const plan: ImportPlan = { columns: [], creates: [], updates: [], unchanged: 0, warnings: [], errors: [] };
  const parsed = parseCsv(csv);
  if (parsed.error) { plan.errors.push({ line: 1, slug: null, message: parsed.error }); return plan; }
  const [header, ...body] = parsed.records;
  if (!header) { plan.errors.push({ line: 1, slug: null, message: 'The file is empty' }); return plan; }
  const columns = header.cells.map((c) => c.trim());
  plan.columns = columns;
  const known: ReadonlySet<string> = new Set(CATALOGUE_CSV_COLUMNS);
  const unknown = columns.filter((c) => !known.has(c));
  if (unknown.length) plan.errors.push({ line: header.line, slug: null, message: `Not catalogue columns: ${unknown.join(', ')}. The columns are ${CATALOGUE_CSV_COLUMNS.join(', ')}.` });
  const repeated = columns.filter((c, i) => columns.indexOf(c) !== i);
  if (repeated.length) plan.errors.push({ line: header.line, slug: null, message: `A column appears twice: ${[...new Set(repeated)].join(', ')}` });
  if (!columns.includes('slug')) plan.errors.push({ line: header.line, slug: null, message: 'The slug column is required: it is how a row is matched to a car' });
  if (body.length > MAX_IMPORT_ROWS) plan.errors.push({ line: header.line, slug: null, message: `${body.length} rows is more than one import takes (${MAX_IMPORT_ROWS})` });
  if (plan.errors.length) return plan;

  const bySlug = new Map(existing.map((r) => [r.slug, r]));
  const seen = new Map<string, number>();
  for (const record of body) {
    const raw = new Map<CsvColumn, string>();
    columns.forEach((c, i) => raw.set(c as CsvColumn, record.cells[i] ?? ''));
    if (record.cells.length !== columns.length) {
      plan.errors.push({ line: record.line, slug: raw.get('slug')?.trim() || null, message: `${record.cells.length} cells where the header has ${columns.length}; a comma inside a cell needs the cell in double quotes` });
      continue;
    }
    const slugParse = slugSchema.safeParse(raw.get('slug') ?? '');
    if (!slugParse.success) { plan.errors.push({ line: record.line, slug: raw.get('slug')?.trim() || null, message: `slug: ${slugParse.error.issues[0]?.message ?? 'not a slug'}` }); continue; }
    const slug = slugParse.data;
    const earlier = seen.get(slug);
    if (earlier !== undefined) { plan.errors.push({ line: record.line, slug, message: `The same car is on line ${earlier} as well; keep one` }); continue; }
    seen.set(slug, record.line);

    const given: Record<string, unknown> = {};
    for (const [column, value] of raw) {
      if (column === 'slug' || column === 'isActive') continue;
      given[column] = cellValue(column, value);
    }
    let isActive: boolean | undefined;
    if (raw.has('isActive')) {
      const v = yesNo(raw.get('isActive') ?? '');
      if (v === null) { plan.errors.push({ line: record.line, slug, message: 'isActive: yes or no' }); continue; }
      isActive = v;
    }

    const current = bySlug.get(slug);
    if (!current) {
      const missing = CATALOGUE_KEYS.filter((k) => !(k in given));
      if (missing.length) { plan.errors.push({ line: record.line, slug, message: `A new car needs every column; this row has no ${missing.join(', ')}` }); continue; }
      const full = z.object(catalogueFields).safeParse(given);
      if (!full.success) { plan.errors.push({ line: record.line, slug, message: issueWords(full.error) }); continue; }
      const problem = crossFieldProblem(full.data, now);
      if (problem) { plan.errors.push({ line: record.line, slug, message: problem }); continue; }
      plan.creates.push({ line: record.line, slug, data: { ...full.data, isActive: isActive ?? true } });
      continue;
    }

    const partial = z.object(catalogueFields).partial().safeParse(given);
    if (!partial.success) { plan.errors.push({ line: record.line, slug, message: issueWords(partial.error) }); continue; }
    const before = { ...fieldsOf(current), isActive: current.isActive };
    const patch: Partial<CatalogueFields> & { isActive?: boolean } = { ...partial.data, ...(isActive === undefined ? {} : { isActive }) };
    const changes = diffCatalogue(before, patch);
    if (Object.keys(changes).length === 0) { plan.unchanged += 1; continue; }
    const problem = crossFieldProblem(mergeFields(before, partial.data), now);
    if (problem) { plan.errors.push({ line: record.line, slug, message: problem }); continue; }
    if (changesFigures(changes)) {
      if (!('asAt' in given)) { plan.errors.push({ line: record.line, slug, message: 'This row changes the figures, so the file needs the asAt column: members read it next to them' }); continue; }
      if (!changes.asAt) plan.warnings.push({ line: record.line, slug, message: `The figures change but the as-at stays "${before.asAt}", so members will read the old line next to the new numbers` });
    }
    const onlyChanged = Object.fromEntries(Object.keys(changes).map((k) => [k, (patch as Record<string, unknown>)[k]])) as Partial<CatalogueFields> & { isActive?: boolean };
    // The as-at goes with a figure change even when it reads the same, so the
    // audit row records the line the admin confirmed alongside the numbers.
    if (changesFigures(changes) && partial.data.asAt !== undefined) onlyChanged.asAt = partial.data.asAt;
    plan.updates.push({ line: record.line, slug, id: current.id, changes, patch: onlyChanged });
  }
  return plan;
}

// ------------------------------------------------------------ last checked

/**
 * How long a row may go unchecked before it is due again. Prices move with
 * each model year and again mid-year, equipment moves with them, and ANCAP
 * publishes new results through the year; six months means every row is
 * looked at twice in a model year. It is the team's own standard, not a
 * figure anyone publishes, and it only decides what the admin page raises.
 */
export const CATALOGUE_RECHECK_DAYS = 180;

export type CatalogueCheck = { at: Date; byUserId: string | null; byName: string | null; adminAction: string; asAt: string };

type AuditLike = { createdAt: Date; actorUserId: string | null; metadata: unknown; actorUser?: { firstName: string | null; lastName: string | null; displayName: string | null } | null };

/**
 * When each row was last checked, from the audit trail. A row counts as
 * checked by any admin action that confirmed an as-at: adding it, changing its
 * figures, an import that did either, or "checked, nothing changed". Retiring
 * or restoring a row, or rewording a highlight, is not a check.
 *
 * The rows are expected newest first; the first one for each car wins. Rows
 * that are not catalogue rows are ignored here as well as in the query, so the
 * answer does not depend on the database having applied the Json filter.
 */
export function latestCatalogueChecks(rows: AuditLike[]): Map<string, CatalogueCheck> {
  const out = new Map<string, CatalogueCheck>();
  for (const row of rows) {
    const m = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : null;
    if (!m || m.resourceType !== 'CarModel' || typeof m.resourceId !== 'string' || typeof m.asAt !== 'string') continue;
    if (out.has(m.resourceId)) continue;
    const u = row.actorUser;
    const name = u ? (u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || null) : null;
    out.set(m.resourceId, { at: row.createdAt, byUserId: row.actorUserId, byName: name, adminAction: String(m.adminAction ?? ''), asAt: m.asAt });
  }
  return out;
}

export type CatalogueFlag = { key: 'UNCHECKED' | 'CHECK_DUE' | 'ANCAP_LAPSED' | 'ANCAP_UNRATED' | 'NO_SOURCE'; words: string };

/** What the admin page raises about a row, most pressing first. */
export function catalogueFlags(row: Pick<CarModel, 'isActive' | 'ancapStars' | 'ancapYear' | 'sourceUrl'>, check: CatalogueCheck | undefined, now = new Date()): CatalogueFlag[] {
  const flags: CatalogueFlag[] = [];
  if (row.isActive) {
    if (!check) flags.push({ key: 'UNCHECKED', words: 'Never checked by the team: these are the starter figures, loaded when the catalogue was first put in place' });
    else {
      const days = Math.floor((now.getTime() - check.at.getTime()) / 86_400_000);
      if (days >= CATALOGUE_RECHECK_DAYS) flags.push({ key: 'CHECK_DUE', words: `Last checked ${days} days ago; due every ${CATALOGUE_RECHECK_DAYS}` });
    }
  }
  const ancap = ancapStatus(row.ancapStars, row.ancapYear, now);
  if (ancap.status === 'expired') flags.push({ key: 'ANCAP_LAPSED', words: `The ${row.ancapYear} rating lapsed after ${ANCAP_VALID_YEARS} years; see whether ANCAP has tested the current model` });
  if (ancap.status === 'unrated') flags.push({ key: 'ANCAP_UNRATED', words: 'No ANCAP rating on file; see whether one has been published' });
  if (!row.sourceUrl) flags.push({ key: 'NO_SOURCE', words: 'No source link, so members cannot see where the figures came from' });
  return flags;
}

/** An active row that needs looking at: never checked, or not within the recheck period. */
export const isDue = (flags: CatalogueFlag[]): boolean => flags.some((f) => f.key === 'UNCHECKED' || f.key === 'CHECK_DUE');
