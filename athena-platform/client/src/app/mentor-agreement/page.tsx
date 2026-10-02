import Link from 'next/link';
import { MENTOR_PLATFORM_FEE_PERCENT, MINIMUM_PAYOUT_AUD } from '@/lib/pricing';

/**
 * What a mentor agrees to when she ticks the box on the become-a-mentor form.
 *
 * This page used to open by saying "the final mentor agreement is issued
 * during mentor approval and onboarding", and closed by telling her the full
 * terms "should be reviewed during mentor onboarding before listings go live".
 * There is no approval and no onboarding review: the profile goes live the
 * moment the form is submitted, which the form itself says beside the box. So
 * a woman who read this before publishing was promised a second, fuller set of
 * terms that never arrived, and the only terms she actually accepted were the
 * vague ones in between. Every line below is what the platform does, taken
 * from the booking and payment code rather than from what it might do one day.
 */
export default function MentorAgreementPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Mentor Agreement</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        These are the terms you accept when you publish a mentor profile. There is no separate approval step: your
        profile goes live as soon as you submit the form, and these terms apply from then on, alongside the{' '}
        <Link href="/terms" className="text-primary-600 hover:underline dark:text-primary-400">
          Terms of Service
        </Link>
        .
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Mentor responsibilities</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              Pause new requests from{' '}
              <Link href="/dashboard/mentors" className="text-primary-600 hover:underline dark:text-primary-400">
                Your mentor profile on the Mentors page
              </Link>{' '}
              when you are not available. Sessions already booked stay as they are.
            </li>
            <li>
              Mentees can ask for any hour from 9am to 5pm, Monday to Friday, in your time zone, that is not already
              booked. Every request is yours to accept or decline.
            </li>
            <li>Keep your rate and expertise accurate. You can change both from the same form you published with.</li>
            <li>Deliver sessions professionally, and keep what mentees tell you confidential.</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Money</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              You can mentor for free. A paid rate needs payouts connected through Stripe from{' '}
              <Link href="/dashboard/earnings" className="text-primary-600 hover:underline dark:text-primary-400">
                Payouts &amp; earnings
              </Link>{' '}
              before anyone can book you.
            </li>
            <li>
              ATHENA keeps {MENTOR_PLATFORM_FEE_PERCENT}% of each paid session. The rest goes to your Stripe account, on the payout schedule Stripe
              sets for it.
            </li>
            <li>
              ATHENA sets no minimum on what you can withdraw from your Stripe balance, and takes no fee when you do. The
              A${MINIMUM_PAYOUT_AUD} minimum in the Terms is for creator gifts only. Stripe pays your bank on the schedule
              it sets for your account, and its own rules apply.
            </li>
            <li>
              A mentee&apos;s card is held when she books and is charged when the session is marked complete, which can
              happen once its booked time has passed. A card hold lasts about seven days, so a paid session can only be
              booked up to six days ahead, and you can mark it complete for a day after the hour. You see a paid request,
              and are told about it, once the mentee has authorised the payment, so you can be sure there is money behind
              it before you accept. A request that is not paid for within a few hours is cancelled, and nothing is
              charged.
            </li>
            <li>
              Either of you can cancel a confirmed session until it is due to end, and the hold is released. After
              that, only you can cancel it. A request you have not accepted, she can withdraw at any time.
            </li>
          </ul>
        </section>
      </div>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
        A mentee who says a session did not take place can raise it with ATHENA support. An account suspended under
        the Terms of Service is taken out of the mentor directory and cannot be booked.
      </div>
      <div className="mt-8">
        <Link
          href="/dashboard/mentors/become-mentor"
          className="btn-primary inline-flex items-center px-5 py-2.5 text-sm"
        >
          Become a mentor
        </Link>
      </div>
    </div>
  );
}
