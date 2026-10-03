/**
 * Registration creates the account and then sends the confirmation email. When
 * the email cannot be sent the server answers 503 with this code, which means
 * "your details are saved, only the email did not go", the opposite of a
 * sign-up that failed. The page shows the resend form in place of an error and
 * a blank form, because resending is the one thing she needs to do next and
 * filling the form in again would only meet "check your email" a second time.
 */
export const VERIFICATION_EMAIL_FAILED = 'VERIFICATION_EMAIL_FAILED';

/** Whether an error from the sign-up request is the server saying only the email failed. */
export function isVerificationEmailFailure(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)?.response;
  return response?.status === 503 && response?.data?.code === VERIFICATION_EMAIL_FAILED;
}
