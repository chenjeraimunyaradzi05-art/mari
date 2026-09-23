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
