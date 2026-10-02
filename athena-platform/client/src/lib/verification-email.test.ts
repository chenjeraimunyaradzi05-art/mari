import { VERIFICATION_EMAIL_FAILED, isVerificationEmailFailure } from './verification-email';

describe('isVerificationEmailFailure', () => {
  it('recognises the 503 the server sends when only the confirmation email failed', () => {
    expect(isVerificationEmailFailure({ response: { status: 503, data: { code: VERIFICATION_EMAIL_FAILED } } })).toBe(true);
  });

  it('does not mistake any other refusal for it', () => {
    // A 503 with no code is the platform being down, not an account waiting for its email.
    expect(isVerificationEmailFailure({ response: { status: 503, data: { message: 'Maintenance' } } })).toBe(false);
    expect(isVerificationEmailFailure({ response: { status: 400, data: { code: VERIFICATION_EMAIL_FAILED } } })).toBe(false);
    expect(isVerificationEmailFailure({ response: { status: 400, data: { message: 'Invalid' } } })).toBe(false);
  });

  it('copes with errors that never reached the server', () => {
    expect(isVerificationEmailFailure(new Error('Network Error'))).toBe(false);
    expect(isVerificationEmailFailure(null)).toBe(false);
    expect(isVerificationEmailFailure(undefined)).toBe(false);
  });
});
