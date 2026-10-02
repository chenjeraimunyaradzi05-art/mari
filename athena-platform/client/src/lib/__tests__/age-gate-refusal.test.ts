import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

/**
 * The two ways the server refuses a write on the minimum age, read from the real
 * API client with an adapter standing in for the network. Neither was recognised
 * anywhere in the client, so a member whose account has no date of birth got a
 * bare error toast from whichever button she pressed and no way to the form that
 * would let her through.
 */

import { api } from '../api';
import { saveDateOfBirth } from '../woman-gate';
import {
  AGE_GATE_CLEARED_EVENT,
  AGE_GATE_CONTACT_PATH,
  AGE_GATE_FALLBACK_SETUP,
  AGE_GATE_REFUSAL_EVENT,
  ageGateRefusalOf,
  announceAgeGateRefusal,
  type AgeGateRefusal,
} from '../age-gate-refusal';

const MISSING_MESSAGE = 'Please add your date of birth before using this part of ATHENA.';
const UNDERAGE_MESSAGE = 'ATHENA accounts are for adults, so this part of the platform is not available on your account.';

function refusal(status: number, data: Record<string, unknown>) {
  return { response: { status, data } };
}

describe('ageGateRefusalOf', () => {
  it('reads "give your date of birth" with the sentence and the page that collects it', () => {
    const read = ageGateRefusalOf(
      refusal(403, { code: 'DATE_OF_BIRTH_REQUIRED', error: MISSING_MESSAGE, setup: '/dashboard/settings/profile' })
    );

    expect(read).toEqual({ kind: 'DATE_REQUIRED', message: MISSING_MESSAGE, setup: '/dashboard/settings/profile' });
  });

  it('sends an under-age account to us, because there is nothing for her to fill in', () => {
    const read = ageGateRefusalOf(refusal(403, { code: 'MINIMUM_AGE_NOT_MET', error: UNDERAGE_MESSAGE }));

    expect(read).toEqual({ kind: 'UNDER_AGE', message: UNDERAGE_MESSAGE, setup: AGE_GATE_CONTACT_PATH });
  });

  it('never sends an under-age account to the date form, whatever page the server names', () => {
    const read = ageGateRefusalOf(refusal(403, { code: 'MINIMUM_AGE_NOT_MET', error: UNDERAGE_MESSAGE, setup: '/dashboard/settings/profile' }));

    expect(read?.setup).toBe(AGE_GATE_CONTACT_PATH);
  });

  it('reads the sentence from `message` as well as `error`', () => {
    expect(ageGateRefusalOf(refusal(403, { code: 'DATE_OF_BIRTH_REQUIRED', message: MISSING_MESSAGE }))?.message).toBe(MISSING_MESSAGE);
  });

  it('falls back to a page of ours when the server names none, or names one that is not on this site', () => {
    for (const setup of [undefined, '', 'https://evil.example/profile', '//evil.example', 42]) {
      expect(ageGateRefusalOf(refusal(403, { code: 'DATE_OF_BIRTH_REQUIRED', error: MISSING_MESSAGE, setup }))?.setup).toBe(
        AGE_GATE_FALLBACK_SETUP
      );
    }
  });

  it('says something honest when the reply carries no sentence, and never states the number', () => {
    const missing = ageGateRefusalOf(refusal(403, { code: 'DATE_OF_BIRTH_REQUIRED' }));
    const under = ageGateRefusalOf(refusal(403, { code: 'MINIMUM_AGE_NOT_MET' }));

    expect(missing?.message).toMatch(/date of birth/i);
    expect(under?.message).toMatch(/for adults/i);
    expect(JSON.stringify([missing, under])).not.toMatch(/\b18\b/);
  });

  it('reads nothing into any other refusal, or any other status', () => {
    expect(ageGateRefusalOf(refusal(403, { code: 'WOMAN_VERIFICATION_REJECTED', message: 'x' }))).toBeNull();
    expect(ageGateRefusalOf(refusal(403, { code: 'TWO_FACTOR_REQUIRED', message: 'x' }))).toBeNull();
    expect(ageGateRefusalOf(refusal(403, { message: 'Forbidden' }))).toBeNull();
    expect(ageGateRefusalOf(refusal(401, { code: 'DATE_OF_BIRTH_REQUIRED', message: 'x' }))).toBeNull();
    expect(ageGateRefusalOf(refusal(400, { code: 'DATE_OF_BIRTH_REQUIRED', message: 'x' }))).toBeNull();
    expect(ageGateRefusalOf(new Error('network'))).toBeNull();
    expect(ageGateRefusalOf(null)).toBeNull();
  });
});

describe('announceAgeGateRefusal', () => {
  it('tells the page once, with the refusal', () => {
    const heard: AgeGateRefusal[] = [];
    const listener = (event: Event) => heard.push((event as CustomEvent<AgeGateRefusal>).detail);
    window.addEventListener(AGE_GATE_REFUSAL_EVENT, listener);

    const sent: AgeGateRefusal = { kind: 'DATE_REQUIRED', message: MISSING_MESSAGE, setup: '/dashboard/settings/profile' };
    announceAgeGateRefusal(sent);
    window.removeEventListener(AGE_GATE_REFUSAL_EVENT, listener);

    expect(heard).toEqual([sent]);
  });
});

describe('the API client and an age refusal', () => {
  const originalAdapter = api.defaults.adapter;
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  function adapterRefusing(data: Record<string, unknown>, status = 403): AxiosAdapter {
    return async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, {
        status,
        statusText: 'Forbidden',
        headers: {},
        config,
        data,
      });
    };
  }

  function listen() {
    const heard: AgeGateRefusal[] = [];
    const listener = (event: Event) => heard.push((event as CustomEvent<AgeGateRefusal>).detail);
    window.addEventListener(AGE_GATE_REFUSAL_EVENT, listener);
    return { heard, stop: () => window.removeEventListener(AGE_GATE_REFUSAL_EVENT, listener) };
  }

  it('announces a missing date of birth, and still fails the request so the button she pressed shows the sentence', async () => {
    api.defaults.adapter = adapterRefusing({ code: 'DATE_OF_BIRTH_REQUIRED', error: MISSING_MESSAGE, setup: '/dashboard/settings/profile' });
    const { heard, stop } = listen();

    await expect(api.post('/posts', { content: 'hello' })).rejects.toMatchObject({ response: { status: 403 } });
    stop();

    expect(heard).toEqual([{ kind: 'DATE_REQUIRED', message: MISSING_MESSAGE, setup: '/dashboard/settings/profile' }]);
  });

  it('announces an under-age account as one to write to us about', async () => {
    api.defaults.adapter = adapterRefusing({ code: 'MINIMUM_AGE_NOT_MET', error: UNDERAGE_MESSAGE });
    const { heard, stop } = listen();

    await expect(api.post('/posts', { content: 'hello' })).rejects.toBeTruthy();
    stop();

    expect(heard).toEqual([{ kind: 'UNDER_AGE', message: UNDERAGE_MESSAGE, setup: AGE_GATE_CONTACT_PATH }]);
  });

  it('does not mistake a women-only refusal, or an ordinary one, for an age refusal', async () => {
    const { heard, stop } = listen();

    api.defaults.adapter = adapterRefusing({ code: 'WOMAN_VERIFICATION_REJECTED', message: 'Your membership did not pass the women-only check.' });
    await expect(api.post('/posts', { content: 'hi' })).rejects.toBeTruthy();
    api.defaults.adapter = adapterRefusing({ message: 'Forbidden' });
    await expect(api.post('/posts', { content: 'hi' })).rejects.toBeTruthy();
    stop();

    expect(heard).toEqual([]);
  });
});

describe('saving a date of birth', () => {
  const originalAdapter = api.defaults.adapter;
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  function heardCleared() {
    const heard: string[] = [];
    const listener = () => heard.push('cleared');
    window.addEventListener(AGE_GATE_CLEARED_EVENT, listener);
    return { heard, stop: () => window.removeEventListener(AGE_GATE_CLEARED_EVENT, listener) };
  }

  it('tells the page the account now has one, so a notice asking for it can go', async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { success: true },
    });
    const { heard, stop } = heardCleared();

    await saveDateOfBirth('1990-05-17');
    stop();

    expect(heard).toEqual(['cleared']);
  });

  it('says nothing when the save was refused, because the date is not on the account', async () => {
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', config, null, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config,
        data: { message: 'Please enter your date of birth. ATHENA accounts are for adults.' },
      });
    };
    const { heard, stop } = heardCleared();

    await expect(saveDateOfBirth('2015-05-17')).rejects.toBeTruthy();
    stop();

    expect(heard).toEqual([]);
  });
});
