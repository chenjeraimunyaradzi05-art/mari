/**
 * The catalogue the team keeps: what a row may hold, what an import would
 * do, when a row was last checked, and the start-up step that must never
 * again write the starter figures over what the team has done since.
 *
 * The export-then-import test is the one to read first. The whole point of
 * the CSV is that an admin can take the catalogue into a spreadsheet, change
 * three prices and bring it back; if a file that comes straight back in
 * reported a single change, every import would bury the real ones in noise,
 * or worse, write a rounding or a lost quote over a figure nobody touched.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Prisma, type CarModel } from '@prisma/client';

const createMany = jest.fn(async (_args: { data: unknown[]; skipDuplicates?: boolean }) => ({ count: 3 }));
jest.mock('../../../utils/prisma', () => ({ prisma: { carModel: { createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => createMany(args) } } }));
jest.mock('../../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { CAR_SEEDS, CATALOGUE_AS_AT, ancapStatus } from '../automotive-library';
import { ensureCarCatalogue, starterRow } from '../automotive-catalogue';
import {
  CATALOGUE_CSV_COLUMNS, CATALOGUE_RECHECK_DAYS, catalogueCreateSchema, catalogueFlags, cataloguePatchSchema, catalogueSlug, catalogueToCsv, changesFigures, crossFieldProblem, diffCatalogue, fieldsOf, isDue,
  latestCatalogueChecks, mergeFields, parseCsv, planCatalogueImport, type CatalogueFields,
} from '../catalogue-admin.service';

const NOW = new Date('2026-09-26T09:00:00Z');
const DAY = 86_400_000;

/** A CarModel row as Postgres would return it, Decimals and all, built from a starter entry. */
function carRow(index: number, over: Partial<CarModel> = {}): CarModel {
  const s = starterRow(CAR_SEEDS[index]);
  const dec = (n: number | null) => (n === null ? null : new Prisma.Decimal(n));
  return {
    id: `car-${index}`, ...s, fuelPer100: dec(s.fuelPer100), kwhPer100: dec(s.kwhPer100), co2GramsKm: null, ratingAvg: new Prisma.Decimal(0), ratingCount: 0, reliabilityAvg: new Prisma.Decimal(0),
    createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'), ...over,
  } as CarModel;
}

const baseFields = (): CatalogueFields => ({ ...fieldsOf(carRow(0)), asAt: 'Checked 26 September 2026' });

describe('What a catalogue row may hold', () => {
  it('holds the starter list to the same rules an admin is held to', () => {
    for (const seed of CAR_SEEDS) {
      const parsed = catalogueCreateSchema.safeParse({ ...starterRow(seed), co2GramsKm: null });
      expect(parsed.success ? null : `${seed.slug}: ${parsed.error.issues[0]?.message}`).toBeNull();
      if (parsed.success) expect(`${seed.slug}: ${crossFieldProblem(parsed.data, NOW)}`).toBe(`${seed.slug}: null`);
    }
  });

  it('refuses a star count without its year, and a year without stars', () => {
    expect(crossFieldProblem({ ...baseFields(), ancapStars: 5, ancapYear: null }, NOW)).toMatch(/stars and the year/);
    expect(crossFieldProblem({ ...baseFields(), ancapStars: null, ancapYear: 2024 }, NOW)).toMatch(/stars and the year/);
    expect(crossFieldProblem({ ...baseFields(), ancapStars: null, ancapYear: null }, NOW)).toBeNull();
  });

  it('refuses a rating from the future, which would read as current for years too long', () => {
    expect(crossFieldProblem({ ...baseFields(), ancapStars: 5, ancapYear: 2027 }, NOW)).toMatch(/later than 2026/);
  });

  it('keeps litres off an electric car and kWh off a car with no plug', () => {
    expect(crossFieldProblem({ ...baseFields(), fuelType: 'ELECTRIC', fuelPer100: 5, kwhPer100: 15 }, NOW)).toMatch(/electric car uses no fuel/);
    expect(crossFieldProblem({ ...baseFields(), fuelType: 'HYBRID', kwhPer100: 15 }, NOW)).toMatch(/Only an electric car or a plug-in/);
    expect(crossFieldProblem({ ...baseFields(), fuelType: 'PLUG_IN_HYBRID', fuelPer100: 1.2, kwhPer100: 18 }, NOW)).toBeNull();
  });

  it('refuses a warranty distance with no years for it to run', () => {
    expect(crossFieldProblem({ ...baseFields(), warrantyYears: null, warrantyKm: 150000 }, NOW)).toMatch(/warranty distance/);
  });

  it('reads an empty field as not published, never as zero, and refuses a safety key the guide does not have', () => {
    const parsed = cataloguePatchSchema.parse({ fuelPer100: '', servicingCostYear: '  ', variant: '' });
    expect(parsed).toEqual({ fuelPer100: null, servicingCostYear: null, variant: null });
    expect(cataloguePatchSchema.safeParse({ safetyFeatures: ['aeb', 'rocket_boosters'] }).success).toBe(false);
    expect(cataloguePatchSchema.parse({ safetyFeatures: ['aeb', 'aeb', 'esc'] }).safetyFeatures).toEqual(['aeb', 'esc']);
  });

  it('refuses a source that is not a web link a member can safely follow', () => {
    expect(cataloguePatchSchema.safeParse({ sourceUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(cataloguePatchSchema.parse({ sourceUrl: 'https://www.toyota.com.au/corolla/prices' }).sourceUrl).toBe('https://www.toyota.com.au/corolla/prices');
  });

  it('lays a patch over a row without letting an undefined key erase a field', () => {
    const merged = mergeFields(baseFields(), { priceFrom: 33000, variant: undefined });
    expect(merged.priceFrom).toBe(33000);
    expect(merged.variant).toBe(baseFields().variant);
  });

  it('makes a slug from the make, model and variant', () => {
    expect(catalogueSlug('Škoda', 'Octavia', 'RS wagon')).toBe('skoda-octavia-rs-wagon');
    expect(catalogueSlug('Mercedes-Benz', 'EQA 250', null)).toBe('mercedes-benz-eqa-250');
  });
});

describe('Zero stars', () => {
  it('is a rating a car earned, not the absence of one', () => {
    expect(ancapStatus(0, 2023, NOW)).toEqual({ status: 'current', label: '0 stars, tested 2023' });
    expect(ancapStatus(1, 2025, NOW).label).toBe('1 star, tested 2025');
    expect(ancapStatus(null, 2023, NOW).status).toBe('unrated');
  });
});

describe('What changed', () => {
  it('names only the fields that moved, comparing lists by what is in them', () => {
    const before = { ...baseFields(), isActive: true };
    const changes = diffCatalogue(before, { priceFrom: 33000, safetyFeatures: [...before.safetyFeatures], highlights: ['New words'], make: before.make, isActive: undefined });
    expect(changes).toEqual({ priceFrom: { from: before.priceFrom, to: 33000 }, highlights: { from: before.highlights, to: ['New words'] } });
  });

  it('asks for an as-at only when a figure moves', () => {
    expect(changesFigures({ highlights: { from: [], to: ['x'] }, sourceUrl: { from: null, to: 'https://a.example' }, isActive: { from: true, to: false } })).toBe(false);
    expect(changesFigures({ priceFrom: { from: 1, to: 2 } })).toBe(true);
    expect(changesFigures({ ancapYear: { from: 2018, to: 2024 } })).toBe(true);
  });
});

describe('The CSV', () => {
  it('reads what a spreadsheet writes: quotes, doubled quotes, line breaks in a cell, CRLF and a byte-order mark', () => {
    const text = '﻿slug,highlights\r\nmazda-3,"Quiet, composed | The ""nicest"" cabin"\r\nkia-ev6,"Line one\nline two"\r\n,\r\n\r\n';
    const { records, error } = parseCsv(text);
    expect(error).toBeNull();
    expect(records).toEqual([
      { line: 1, cells: ['slug', 'highlights'] },
      { line: 2, cells: ['mazda-3', 'Quiet, composed | The "nicest" cabin'] },
      { line: 3, cells: ['kia-ev6', 'Line one\nline two'] },
    ]);
  });

  it('says where a quoted cell was left open', () => {
    expect(parseCsv('slug,asAt\nmazda-3,"never closed\n').error).toMatch(/line 2/);
  });

  it('comes back unchanged when the export is imported straight back', () => {
    const rows = CAR_SEEDS.map((_, i) => carRow(i, { sourceUrl: i % 2 ? `https://maker.example/${i}` : null, asAt: i % 3 ? CATALOGUE_AS_AT : 'Checked 1 September 2026, "drive-away" in Brisbane' }));
    rows[4] = { ...rows[4], isActive: false };
    const csv = catalogueToCsv(rows);
    expect(csv.split('\r\n')[0]).toBe(CATALOGUE_CSV_COLUMNS.join(','));
    const plan = planCatalogueImport(csv, rows, NOW);
    expect(plan.errors).toEqual([]);
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toBe(rows.length);
  });

  it('writes a cell a spreadsheet would run as a formula as text, and reads it back as it was', () => {
    const row = carRow(0, { highlights: ['=HYPERLINK("https://evil.example","click")', '-20% off, they say'] });
    const csv = catalogueToCsv([row]);
    // A spreadsheet only runs a cell that starts with one of these, so the
    // guard is on the cell, not on each item in the list.
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"",""click"") | -20% off, they say"`);
    const plan = planCatalogueImport(csv, [row], NOW);
    expect(plan.unchanged).toBe(1);
    expect(plan.errors).toEqual([]);
  });
});

describe('An import plan', () => {
  const rows = [carRow(0), carRow(1), carRow(2)];

  it('reprices from a file with only the columns it changes, and leaves the rest alone', () => {
    const plan = planCatalogueImport(`slug,priceFrom,asAt\n${rows[0].slug},33990,Checked 26 September 2026: list price before on-road costs\n`, rows, NOW);
    expect(plan.errors).toEqual([]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].changes).toEqual({ priceFrom: { from: rows[0].priceFrom, to: 33990 }, asAt: { from: CATALOGUE_AS_AT, to: 'Checked 26 September 2026: list price before on-road costs' } });
    expect(plan.updates[0].patch).toEqual({ priceFrom: 33990, asAt: 'Checked 26 September 2026: list price before on-road costs' });
  });

  it('refuses a figure change that carries no as-at at all', () => {
    const plan = planCatalogueImport(`slug,priceFrom\n${rows[0].slug},33990\n`, rows, NOW);
    expect(plan.updates).toEqual([]);
    expect(plan.errors[0].message).toMatch(/needs the asAt column/);
  });

  it('warns when the figures move and the as-at does not', () => {
    const plan = planCatalogueImport(`slug,priceFrom,asAt\n${rows[0].slug},33990,"${CATALOGUE_AS_AT}"\n`, rows, NOW);
    expect(plan.errors).toEqual([]);
    expect(plan.updates[0].patch).toEqual({ priceFrom: 33990, asAt: CATALOGUE_AS_AT });
    expect(plan.warnings[0].message).toMatch(/old line next to the new numbers/);
  });

  it('adds a car the catalogue does not have, but only with every column', () => {
    const full = catalogueToCsv([carRow(3, { slug: 'new-car-2027' })]);
    const plan = planCatalogueImport(full, rows, NOW);
    expect(plan.creates.map((c) => c.slug)).toEqual(['new-car-2027']);
    const partial = planCatalogueImport('slug,priceFrom,asAt\nanother-new-car,30000,Checked today\n', rows, NOW);
    expect(partial.creates).toEqual([]);
    expect(partial.errors[0].message).toMatch(/A new car needs every column/);
  });

  it('retires a car through the isActive column', () => {
    const plan = planCatalogueImport(`slug,isActive\n${rows[1].slug},no\n`, rows, NOW);
    expect(plan.updates[0].changes).toEqual({ isActive: { from: true, to: false } });
    expect(planCatalogueImport(`slug,isActive\n${rows[1].slug},maybe\n`, rows, NOW).errors[0].message).toMatch(/yes or no/);
  });

  it('reports every kind of bad row by its line, and plans nothing for a bad header', () => {
    const plan = planCatalogueImport([
      'slug,priceFrom,asAt,ancapStars',
      `${rows[0].slug},32000,Checked,5`,
      `${rows[0].slug},32500,Checked,5`,
      `${rows[1].slug},12,Checked,5`,
      `${rows[2].slug},40000,Checked`,
      'Not A Slug,40000,Checked,5',
      `${rows[2].slug.replace(/-/g, '_')},1,2,3`,
    ].join('\n'), rows, NOW);
    expect(plan.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7]);
    expect(plan.errors[0].message).toMatch(/on line 2 as well/);
    expect(plan.errors[1].message).toMatch(/priceFrom/);
    expect(plan.errors[2].message).toMatch(/cells where the header has/);
    expect(planCatalogueImport('slug,colour\nmazda-3,red\n', rows, NOW).errors[0].message).toMatch(/Not catalogue columns: colour/);
    expect(planCatalogueImport('priceFrom\n30000\n', rows, NOW).errors[0].message).toMatch(/slug column is required/);
  });

  it('holds an import to the rules across fields, checked on the row as it would stand', () => {
    expect(rows[0].fuelType).toBe('HYBRID');
    const plan = planCatalogueImport(`slug,fuelType,asAt\n${rows[0].slug},ELECTRIC,Checked today\n`, rows, NOW);
    expect(plan.errors[0].message).toMatch(/electric car uses no fuel/);
  });
});

describe('When each car was last checked', () => {
  const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY);
  const audit = (daysAgo: number, metadata: Record<string, unknown>, who = 'Priya') => ({ createdAt: at(daysAgo), actorUserId: `u-${who}`, metadata, actorUser: { firstName: who, lastName: 'Admin', displayName: null } });

  it('takes the newest check for each car, and does not count a retirement or someone else\'s rows as one', () => {
    const checks = latestCatalogueChecks([
      audit(1, { resourceType: 'CarModel', resourceId: 'a', adminAction: 'CAR_CATALOGUE_MODEL_RETIRED' }),
      audit(2, { resourceType: 'CarModel', resourceId: 'a', adminAction: 'CAR_CATALOGUE_MODEL_CHECKED', asAt: 'Checked in September' }, 'Mei'),
      audit(3, { resourceType: 'Mechanic', resourceId: 'b', asAt: 'not a car' }),
      audit(9, { resourceType: 'CarModel', resourceId: 'a', adminAction: 'CAR_CATALOGUE_MODEL_UPDATED', asAt: 'Older' }),
    ]);
    expect([...checks.keys()]).toEqual(['a']);
    expect(checks.get('a')).toMatchObject({ at: at(2), byName: 'Mei Admin', asAt: 'Checked in September', adminAction: 'CAR_CATALOGUE_MODEL_CHECKED' });
  });

  it('raises a starter row nobody has checked, and a checked one once the recheck period has passed', () => {
    const row = carRow(0);
    expect(catalogueFlags(row, undefined, NOW).map((f) => f.key)).toEqual(['UNCHECKED', 'ANCAP_LAPSED', 'NO_SOURCE']);
    const recent = { at: at(CATALOGUE_RECHECK_DAYS - 1), byUserId: 'u', byName: 'Mei', adminAction: 'CAR_CATALOGUE_MODEL_CHECKED', asAt: 'x' };
    const old = { ...recent, at: at(CATALOGUE_RECHECK_DAYS) };
    expect(isDue(catalogueFlags({ ...row, sourceUrl: 'https://x.example' }, recent, NOW))).toBe(false);
    expect(catalogueFlags(row, old, NOW)[0]).toEqual({ key: 'CHECK_DUE', words: `Last checked ${CATALOGUE_RECHECK_DAYS} days ago; due every ${CATALOGUE_RECHECK_DAYS}` });
    expect(isDue(catalogueFlags({ ...row, isActive: false }, undefined, NOW))).toBe(false);
    expect(catalogueFlags({ ...row, ancapStars: null, ancapYear: null }, recent, NOW).map((f) => f.key)).toContain('ANCAP_UNRATED');
  });
});

describe('Putting the starter list in place', () => {
  beforeEach(() => { createMany.mockClear(); });

  it('creates only what is missing and never writes over a row that is there', async () => {
    const result = await ensureCarCatalogue();
    expect(createMany).toHaveBeenCalledTimes(1);
    const args = createMany.mock.calls[0][0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data).toHaveLength(CAR_SEEDS.length);
    expect(args.data[0]).toMatchObject({ slug: CAR_SEEDS[0].slug, asAt: CATALOGUE_AS_AT, sourceUrl: null, isActive: true });
    expect(result).toEqual({ created: 3, starter: CAR_SEEDS.length });
  });
});
