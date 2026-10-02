/**
 * The register in gdpr.service.ts is what both data subject rights walk, so a
 * table missing from it is invisible to an export and survives an erasure. It
 * had fallen more than fifty tables behind the schema — including the domestic
 * violence safe chats, the health diary, medications and the bank feed — and
 * nothing in the build said so, because nothing compared the two.
 *
 * This suite is that comparison. It reads prisma/schema.prisma directly rather
 * than the generated client, so adding a model that stores a member id fails
 * here until somebody registers it or records in
 * MODELS_OUTSIDE_PERSONAL_DATA_REGISTER why it is out.
 */

jest.mock('../../utils/prisma', () => ({ prisma: {} }));

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  INCIDENT_COLUMNS_SHOWN_TO_SUBJECT,
  PERSONAL_DATA_MODELS,
  MODELS_OUTSIDE_PERSONAL_DATA_REGISTER,
  REPORT_COLUMNS_SHOWN_TO_SUBJECT,
} from '../gdpr.service';

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

interface SchemaModel {
  name: string;
  /** Prisma delegate name: the model name with its first letter lowercased. */
  delegate: string;
  fields: string[];
  /** Fields the schema marks with a trailing `?`, so the database accepts null. */
  nullableFields: Set<string>;
  /** Columns this model uses to point at a User row, however it does it. */
  personKeys: string[];
}

/**
 * Column names that carry a member id. Prisma will not tell us: some of these
 * columns have a foreign key to User and some, like DvSafeMessage.senderId and
 * AdminFlag.flaggedById, deliberately do not, and it is exactly the ones
 * without a foreign key that a schema-relation check would miss.
 *
 * A new name for the same idea belongs in this list. Adding one can only make
 * the check stricter.
 */
const PERSON_ID_COLUMN =
  /^(userId|.*UserId|memberId|ownerId|senderId|receiverId|recipientId|authorId|hostId|requesterId|requestedById|targetId|clientId|providerId|menteeId|mentorId|buyerId|sellerId|reporterId|reviewerId|reviewedById|createdById|facilitatorId|moderatorId|flaggedById|resolvedById|candidateId|followerId|followingId|friendId|referrerId|referredId|postedById|approvedBy|convertedUserId|inspectorId|agentId)$/;

function parseSchema(): SchemaModel[] {
  const models: SchemaModel[] = [];
  const blocks = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

  let block: RegExpExecArray | null;
  while ((block = blocks.exec(schema)) !== null) {
    const [, name, body] = block;
    const fields: string[] = [];
    const nullableFields = new Set<string>();
    const personKeys = new Set<string>();

    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;

      const field = line.match(/^(\w+)\s+(\S+)(.*)$/);
      if (!field) continue;
      const [, fieldName, fieldType, rest] = field;
      fields.push(fieldName);
      if (fieldType.endsWith('?')) nullableFields.add(fieldName);

      // A relation field naming the columns it owns: `user User @relation(fields: [userId], ...)`.
      if (/^User(\?)?$/.test(fieldType)) {
        const owned = rest.match(/fields:\s*\[([^\]]*)\]/);
        if (owned) {
          owned[1]
            .split(',')
            .map((column) => column.trim())
            .filter(Boolean)
            .forEach((column) => personKeys.add(column));
        }
        continue;
      }

      // A plain column holding a member id with no foreign key behind it.
      if (/^String(\?)?$/.test(fieldType) && PERSON_ID_COLUMN.test(fieldName)) {
        personKeys.add(fieldName);
      }
    }

    models.push({
      name,
      delegate: name.charAt(0).toLowerCase() + name.slice(1),
      fields,
      nullableFields,
      personKeys: [...personKeys],
    });
  }

  return models;
}

const schemaModels = parseSchema();
const byDelegate = new Map(schemaModels.map((model) => [model.delegate, model]));

describe('the personal data register against the schema', () => {
  it('parses the schema it is meant to be checking', () => {
    // A parser that quietly matched nothing would turn every assertion below
    // into a pass, which is the one failure this suite cannot afford.
    expect(schemaModels.length).toBeGreaterThan(100);
    expect(byDelegate.has('user')).toBe(true);
    expect(byDelegate.get('dvSafeMessage')?.personKeys).toContain('senderId');
  });

  it('registers every table that stores a member id', () => {
    const registered = new Set(PERSONAL_DATA_MODELS.map((entry) => entry.model));
    const covered = (delegate: string) =>
      registered.has(delegate) || delegate in MODELS_OUTSIDE_PERSONAL_DATA_REGISTER;

    const missing = schemaModels
      .filter((model) => model.name !== 'User')
      .filter((model) => model.personKeys.length > 0)
      .filter((model) => !covered(model.delegate))
      .map((model) => `${model.name} (${model.personKeys.join(', ')})`);

    expect(missing).toEqual([]);
  });

  it('names only models and columns the schema actually has', () => {
    const unknownModels: string[] = [];
    const unknownColumns: string[] = [];

    for (const entry of PERSONAL_DATA_MODELS) {
      const model = byDelegate.get(entry.model);
      if (!model) {
        unknownModels.push(entry.model);
        continue;
      }

      for (const key of entry.keys) {
        if (!model.fields.includes(key)) unknownColumns.push(`${entry.model}.${key}`);
      }
    }

    for (const delegate of Object.keys(MODELS_OUTSIDE_PERSONAL_DATA_REGISTER)) {
      if (!byDelegate.has(delegate)) unknownModels.push(delegate);
    }

    expect(unknownModels).toEqual([]);
    expect(unknownColumns).toEqual([]);
  });

  it('gives every entry something to match rows on', () => {
    // subjectFilter throws at runtime on an entry with neither, which would
    // surface as a failed erasure rather than as a mistake in the register. An
    // entry that is skipped by erasure and withheld from the export is never
    // put through a filter at all, which is why legalHolds is allowed none.
    const unmatchable = PERSONAL_DATA_MODELS.filter(
      (entry) => entry.keys.length === 0 && !entry.where
    )
      .filter((entry) => !(entry.erasure === 'skip' && entry.exportable === false))
      .map((entry) => entry.section);

    expect(unmatchable).toEqual([]);
  });

  it('keeps one section per entry, since the export bundle is keyed by it', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const entry of PERSONAL_DATA_MODELS) {
      if (seen.has(entry.section)) duplicates.push(entry.section);
      seen.add(entry.section);
    }

    expect(duplicates).toEqual([]);
  });

  it('explains every row it keeps and every section it withholds', () => {
    const unexplained = PERSONAL_DATA_MODELS.filter(
      (entry) =>
        (entry.erasure === 'retain' || entry.erasure === 'skip' || entry.exportable === false) &&
        !entry.reason?.trim()
    ).map((entry) => entry.section);

    expect(unexplained).toEqual([]);
  });

  it('only detaches or nulls columns the database allows to be null', () => {
    // A detach on a required column fails the whole erasure transaction, and
    // the register cannot tell the difference on its own.
    const required: string[] = [];

    for (const entry of PERSONAL_DATA_MODELS) {
      if (entry.erasure !== 'detach') continue;
      const model = byDelegate.get(entry.model);
      if (!model) continue;

      for (const key of entry.keys) {
        if (!model.nullableFields.has(key)) required.push(`${entry.model}.${key}`);
      }
    }

    expect(required).toEqual([]);
  });

  it('holds the tables an erasure request is really about', () => {
    // Named rather than counted: these are the ones whose absence made an
    // erasure a lie, and a future refactor that drops them should say so here.
    const registered = new Set(PERSONAL_DATA_MODELS.map((entry) => entry.model));

    for (const delegate of [
      'dvSafeMessage',
      'dvSafeChat',
      'dvPanicAlert',
      'dvSafetyProfile',
      'healthEntry',
      'healthNote',
      'medication',
      'bankConnection',
      'bankAccount',
      'bankTransaction',
      'netWorthSnapshot',
    ]) {
      expect(registered.has(delegate)).toBe(true);
    }
  });

  describe('the people who reported or blocked a member', () => {
    // An export that handed a reported man the reporter's account id would be the
    // way he found her: GET /api/users/:id turns an id into a name. The reverse
    // direction (what a reporter is given back about the people she reported) is
    // withheld by exportable:false on safetyIncidentsReported.

    it('never exports a row that names its reporter to the member it is about', () => {
      const exposed = PERSONAL_DATA_MODELS.filter((entry) => entry.exportable !== false)
        .filter((entry) => byDelegate.get(entry.model)?.fields.includes('reporterId'))
        // A member is given back her own reports whole: she is the reporter.
        .filter((entry) => !entry.keys.includes('reporterId'))
        .filter((entry) => {
          if (!entry.readable) return true;
          const shown = entry.readable({ id: 'row', reporterId: 'the-reporter', reportedUserId: 'her', userId: 'her' });
          return 'reporterId' in shown;
        })
        .map((entry) => entry.section);

      expect(exposed).toEqual([]);
    });

    it('classifies every column of those tables, so a new column is not exported by default', () => {
      // What a reported member is shown, and what she is not. A column in neither
      // list fails here until somebody has said which, instead of going out.
      const withheld: Record<string, string[]> = {
        contentReport: ['reporterId', 'description', 'evidence', 'reviewerId', 'reviewNotes', 'aiConfidence', 'aiCategory', 'reviewDeadline', 'priority'],
        safetyIncident: ['reporterId', 'resolvedById', 'metadata'],
      };
      const shown: Record<string, readonly string[]> = {
        contentReport: REPORT_COLUMNS_SHOWN_TO_SUBJECT,
        safetyIncident: INCIDENT_COLUMNS_SHOWN_TO_SUBJECT,
      };

      for (const delegate of Object.keys(shown)) {
        const columns = byDelegate.get(delegate)!.fields;
        const relations = new Set(['reporter', 'reportedUser']);
        const scalar = columns.filter((column) => !relations.has(column));
        expect([...shown[delegate], ...withheld[delegate]].sort()).toEqual([...scalar].sort());
      }
    });

    it('does not export a block, which is never announced to the person it is made against', () => {
      const blocks = PERSONAL_DATA_MODELS.find((entry) => entry.section === 'safetyIncidentsBlocks');
      const incidents = PERSONAL_DATA_MODELS.find((entry) => entry.section === 'safetyIncidents');

      expect(blocks).toMatchObject({ model: 'safetyIncident', erasure: 'delete', exportable: false });
      expect(blocks?.where?.('member-1')).toEqual({ userId: 'member-1', type: 'BLOCK' });
      // And the entry that is exported is the complement, so no row is in both or neither.
      expect(incidents?.where?.('member-1')).toEqual({ userId: 'member-1', type: { not: 'BLOCK' } });
    });
  });

  describe('the places a member listed for rent', () => {
    // HousingListing.agentId is a bare column with no foreign key to User, which
    // is how a lister's street address and her note on why a place is safe came
    // to be in neither her export nor her erasure. The person-id pattern above
    // now includes agentId, so the "registers every table" test fails on its own
    // if the entry is dropped; these say what the entries do.
    it('exports her listings and erases them with her', () => {
      const listings = PERSONAL_DATA_MODELS.find((entry) => entry.model === 'housingListing');
      expect(listings).toMatchObject({ section: 'housingListings', keys: ['agentId'], erasure: 'delete' });
      expect(listings?.exportable).not.toBe(false);
    });

    it('removes the inquiries other women sent about them first, and never hands those back to the lister', () => {
      const order = PERSONAL_DATA_MODELS.map((entry) => entry.section);
      const onHers = PERSONAL_DATA_MODELS.find((entry) => entry.section === 'housingInquiriesOnHerListings');

      expect(onHers).toMatchObject({ model: 'housingInquiry', erasure: 'delete', exportable: false });
      expect(onHers?.reason).toMatch(/alias/);
      // Erasure walks the register top to bottom and a listing with an inquiry
      // still on it cannot be deleted (ON DELETE RESTRICT), so the order matters.
      expect(order.indexOf('housingInquiriesOnHerListings')).toBeGreaterThanOrEqual(0);
      expect(order.indexOf('housingInquiriesOnHerListings')).toBeLessThan(order.indexOf('housingListings'));
      // The filter is the lister's own listings, not the inquiries she herself sent.
      expect(onHers?.where?.('member-1')).toEqual({ listing: { agentId: 'member-1' } });
    });
  });
});
