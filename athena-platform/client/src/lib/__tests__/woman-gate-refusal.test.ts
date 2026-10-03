import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

/**
 * The two ways the server refuses a member on the women-only check, read from
 * the real API client with an adapter standing in for the network. Neither was
 * recognised anywhere in the client, so a member who had not completed the
 * check, or whom a reviewer had refused, got a bare error toast and no way to
 * the page that fixes it.
 */

import { api } from '../api';
import {
  WOMAN_GATE_APPEAL_PATH,
  WOMAN_GATE_FALLBACK_SETUP,
  WOMAN_GATE_REFUSAL_EVENT,
  announceWomanGateRefusal,
  womanGateRefusalOf,
  type WomanGateRefusal,
} from '../woman-gate-refusal';

const REQUIRED_MESSAGE =
  'This part of ATHENA is open to members who have completed the women-only check. It takes a few minutes and is free.';
const REJECTED_MESSAGE =
  'Your membership did not pass the women-only check. If you believe that is wrong, appeal from Settings and a person will look again.';

function refusal(status: number, data: Record<string, unknown>) {
  return { response: { status, data } };
}

describe('womanGateRefusalOf', () => {
  it('reads "complete the check" with the sentence and the page that fixes it', () => {
    const read = womanGateRefusalOf(
      refusal(403, { code: 'WOMAN_VERIFICATION_REQUIRED', message: REQUIRED_MESSAGE, setup: '/dashboard/settings/profile' })
    );

    expect(read).toEqual({ kind: 'REQUIRED', message: REQUIRED_MESSAGE, setup: '/dashboard/settings/profile' });
  });

  it('sends a refused member to the appeal, and never to a form that would ask her to do it again', () => {
    const read = womanGateRefusalOf(
      refusal(403, { code: 'WOMAN_VERIFICATION_REJECTED', message: REJECTED_MESSAGE, setup: '/dashboard/settings/profile' })
    );

    expect(read).toEqual({ kind: 'REJECTED', message: REJECTED_MESSAGE, setup: WOMAN_GATE_APPEAL_PATH });
  });

  it('reads the sentence from `error` when the reply has no `message`', () => {
    expect(womanGateRefusalOf(refusal(403, { code: 'WOMAN_VERIFICATION_REQUIRED', error: REQUIRED_MESSAGE }))?.message).toBe(
      REQUIRED_MESSAGE
    );
  });

  it('falls back to a page of ours when the server names none, or names one that is not on this site', () => {
    for (const setup of [undefined, '', 'https://evil.example/profile', '//evil.example', 42]) {
      expect(womanGateRefusalOf(refusal(403, { code: 'WOMAN_VERIFICATION_REQUIRED', message: REQUIRED_MESSAGE, setup }))?.setup).toBe(
        WOMAN_GATE_FALLBACK_SETUP
      );
    }
  });

  it('says something honest when the reply carries no sentence', () => {
    const read = womanGateRefusalOf(refusal(403, { code: 'WOMAN_VERIFICATION_REJECTED' }));
    expect(read?.message).toMatch(/did not pass the women-only check/i);
    expect(read?.message).toMatch(/appeal/i);
  });

  it('reads nothing into any other refusal, or any other status', () => {
    expect(womanGateRefusalOf(refusal(403, { code: 'TWO_FACTOR_REQUIRED', message: 'x' }))).toBeNull();
    expect(womanGateRefusalOf(refusal(403, { code: 'MINIMUM_AGE_NOT_MET', message: 'x' }))).toBeNull();
    expect(womanGateRefusalOf(refusal(403, { message: 'Forbidden' }))).toBeNull();
    expect(womanGateRefusalOf(refusal(401, { code: 'WOMAN_VERIFICATION_REQUIRED', message: 'x' }))).toBeNull();
    expect(womanGateRefusalOf(refusal(500, { code: 'WOMAN_VERIFICATION_REQUIRED', message: 'x' }))).toBeNull();
    expect(womanGateRefusalOf(new Error('network'))).toBeNull();
    expect(womanGateRefusalOf(null)).toBeNull();
    expect(womanGateRefusalOf(undefined)).toBeNull();
  });
});

describe('announceWomanGateRefusal', () => {
  it('tells the page once, with the refusal', () => {
    const heard: WomanGateRefusal[] = [];
    const listener = (event: Event) => heard.push((event as CustomEvent<WomanGateRefusal>).detail);
    window.addEventListener(WOMAN_GATE_REFUSAL_EVENT, listener);

    const sent: WomanGateRefusal = { kind: 'REQUIRED', message: REQUIRED_MESSAGE, setup: '/dashboard/settings/profile' };
    announceWomanGateRefusal(sent);
    window.removeEventListener(WOMAN_GATE_REFUSAL_EVENT, listener);

    expect(heard).toEqual([sent]);
  });
});

describe('the API client and a women-only refusal', () => {
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
    const heard: WomanGateRefusal[] = [];
    const listener = (event: Event) => heard.push((event as CustomEvent<WomanGateRefusal>).detail);
    window.addEventListener(WOMAN_GATE_REFUSAL_EVENT, listener);
    return { heard, stop: () => window.removeEventListener(WOMAN_GATE_REFUSAL_EVENT, listener) };
  }

  it('announces it, and still fails the request so the button that was pressed shows the sentence', async () => {
    api.defaults.adapter = adapterRefusing({
      code: 'WOMAN_VERIFICATION_REQUIRED',
      message: REQUIRED_MESSAGE,
      setup: '/dashboard/settings/profile',
    });
    const { heard, stop } = listen();

    await expect(api.post('/creator/payouts/request')).rejects.toMatchObject({ response: { status: 403 } });
    stop();

    expect(heard).toEqual([{ kind: 'REQUIRED', message: REQUIRED_MESSAGE, setup: '/dashboard/settings/profile' }]);
  });

  it('announces a reviewer’s refusal as an appeal', async () => {
    api.defaults.adapter = adapterRefusing({ code: 'WOMAN_VERIFICATION_REJECTED', message: REJECTED_MESSAGE });
    const { heard, stop } = listen();

    await expect(api.post('/posts', { content: 'hi' })).rejects.toBeTruthy();
    stop();

    expect(heard).toEqual([{ kind: 'REJECTED', message: REJECTED_MESSAGE, setup: WOMAN_GATE_APPEAL_PATH }]);
  });

  it('says nothing for an ordinary refusal', async () => {
    api.defaults.adapter = adapterRefusing({ message: 'Forbidden' });
    const { heard, stop } = listen();

    await expect(api.post('/posts', { content: 'hi' })).rejects.toBeTruthy();
    stop();

    expect(heard).toEqual([]);
  });
});
