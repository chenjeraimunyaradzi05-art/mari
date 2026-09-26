/**
 * The mirror in src/constants/shared.ts must stay a mirror.
 *
 * The phone cannot import athena-platform/shared at bundle time — it sits
 * outside the EAS project root, with no npm workspace to bring it in — so
 * those constants are copied into mobile/src. A copy nobody checks is a copy
 * that drifts, and the drift here would be silent: a persona added to the
 * shared enum would simply never appear on the sign-up form, and a renamed
 * application status would render as its raw enum name.
 *
 * This test is the check. It imports the real shared package by relative path,
 * which exists in every checkout and in CI (the mobile workflow runs on
 * changes to shared/** as well as mobile/**), and never in a bundle.
 */
import { describe, it, expect } from '@jest/globals';

import { Persona, APPLICATION_STATUS_DISPLAY } from '../shared';
import { Persona as SharedPersona } from '../../../../shared/src';
import { APPLICATION_STATUS_DISPLAY as SHARED_APPLICATION_STATUS_DISPLAY } from '../../../../shared/src/utils';

describe('the mobile copy of the shared constants', () => {
  it('has exactly the personas the shared package has', () => {
    expect({ ...Persona }).toEqual({ ...SharedPersona });
  });

  it('has exactly the application status labels the shared package has', () => {
    expect(APPLICATION_STATUS_DISPLAY).toEqual(SHARED_APPLICATION_STATUS_DISPLAY);
  });
});

/**
 * A mirror of the wrong thing is still wrong. Both copies once carried three
 * persona aliases the database did not have (so 'MID_CAREER' appeared three
 * times in any picker built from the enum) and two application statuses it
 * did not have, while missing ACCEPTED, which it did. The test above kept the
 * copies identical and could not notice. This one reads the enums from the
 * Prisma schema, which is what the server accepts and stores.
 */
describe('the shared constants against the database schema', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const schema = fs.readFileSync(path.resolve(__dirname, '../../../../server/prisma/schema.prisma'), 'utf8');

  function prismaEnum(name: string): string[] {
    const body = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))?.[1];
    if (!body) throw new Error(`enum ${name} not found in schema.prisma`);
    return body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter(Boolean);
  }

  it('has one persona per Prisma persona, each under its own name', () => {
    const values = Object.values(SharedPersona);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual(prismaEnum('Persona').sort());
    for (const [name, value] of Object.entries(SharedPersona)) expect(name).toBe(value);
  });

  it('labels exactly the application statuses Prisma has', () => {
    expect(Object.keys(SHARED_APPLICATION_STATUS_DISPLAY).sort()).toEqual(prismaEnum('ApplicationStatus').sort());
  });
});
