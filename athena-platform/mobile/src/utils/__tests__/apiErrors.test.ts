/**
 * What a failed request says on the phone.
 *
 * The part that is new is the women-only check. A member turned away because
 * she has not completed it used to read the server's sentence and nothing
 * else, with no word on where the check is finished. It is finished on the
 * website, so the sentence says so; a member a reviewer refused is told to
 * appeal by the server's own sentence, which is left as it is.
 */

import { describe, expect, it } from '@jest/globals';
import { apiMessage, errorStatus, isNotFound, loadFailure, womanGateCode } from '../apiErrors';

const REQUIRED =
  'This part of ATHENA is open to members who have completed the women-only check. It takes a few minutes and is free.';
const REJECTED =
  'Your membership did not pass the women-only check. If you believe that is wrong, appeal from Settings and a person will look again.';

const refusal = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });

describe('apiMessage', () => {
  it('is the server’s own sentence when it sent one, from message or from error', () => {
    expect(apiMessage(refusal(400, { message: 'Nope.' }), 'fallback')).toBe('Nope.');
    expect(apiMessage(refusal(400, { error: 'Also nope.' }), 'fallback')).toBe('Also nope.');
    expect(apiMessage(refusal(400, { message: '   ' }), 'fallback')).toBe('fallback');
    expect(apiMessage(new Error('Network Error'), 'fallback')).toBe('fallback');
  });

  it('tells a member who has not completed the women-only check where it is finished', () => {
    const said = apiMessage(refusal(403, { code: 'WOMAN_VERIFICATION_REQUIRED', message: REQUIRED }), 'fallback');

    expect(said.startsWith(REQUIRED)).toBe(true);
    expect(said).toMatch(/Settings on the ATHENA website/);
  });

  it('does not add the pointer twice, or to a sentence that already names the website', () => {
    const already = `${REQUIRED} Use the website.`;
    expect(apiMessage(refusal(403, { code: 'WOMAN_VERIFICATION_REQUIRED', message: already }), 'fallback')).toBe(already);
  });

  it('leaves a refused member’s sentence as the server wrote it, because it already says to appeal', () => {
    expect(apiMessage(refusal(403, { code: 'WOMAN_VERIFICATION_REJECTED', message: REJECTED }), 'fallback')).toBe(REJECTED);
  });

  it('adds nothing to any other refusal, even one with a similar code, or the same code on another status', () => {
    expect(apiMessage(refusal(403, { code: 'TWO_FACTOR_REQUIRED', message: 'Set up two-factor.' }), 'x')).toBe('Set up two-factor.');
    expect(apiMessage(refusal(500, { code: 'WOMAN_VERIFICATION_REQUIRED', message: 'Broken.' }), 'x')).toBe('Broken.');
  });
});

describe('womanGateCode', () => {
  it('reads the two codes on a 403 and nothing else', () => {
    expect(womanGateCode(refusal(403, { code: 'WOMAN_VERIFICATION_REQUIRED' }))).toBe('WOMAN_VERIFICATION_REQUIRED');
    expect(womanGateCode(refusal(403, { code: 'WOMAN_VERIFICATION_REJECTED' }))).toBe('WOMAN_VERIFICATION_REJECTED');
    expect(womanGateCode(refusal(403, { code: 'MINIMUM_AGE_NOT_MET' }))).toBeNull();
    expect(womanGateCode(refusal(401, { code: 'WOMAN_VERIFICATION_REQUIRED' }))).toBeNull();
    expect(womanGateCode(new Error('x'))).toBeNull();
    expect(womanGateCode(undefined)).toBeNull();
  });
});

describe('the rest of the helpers, unchanged', () => {
  it('reads a status and a 404', () => {
    expect(errorStatus(refusal(404, {}))).toBe(404);
    expect(errorStatus(new Error('x'))).toBeNull();
    expect(isNotFound(refusal(404, {}))).toBe(true);
    expect(isNotFound(refusal(500, {}))).toBe(false);
  });

  it('says a load did not get through, never that the thing does not exist', () => {
    expect(loadFailure(new Error('Network Error'), 'Your goals')).toBe('Your goals could not be loaded. Check your connection and try again.');
  });
});
