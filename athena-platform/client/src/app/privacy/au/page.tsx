import Link from 'next/link';
import type { Metadata } from 'next';
import { ExternalLink, Mail, Shield } from 'lucide-react';
import { ORGANISATION, contactLink } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Australian Privacy Statement | ATHENA',
  description: 'How the Australian Privacy Principles and the Notifiable Data Breaches scheme apply to ATHENA.',
};

/**
 * ATHENA is a Queensland company. This page says, principle by principle,
 * how the Australian Privacy Principles in the Privacy Act 1988 (Cth) apply
 * to the platform, and what happens under the Notifiable Data Breaches
 * scheme. It sits beside the general policy and the UK addendum.
 */

const PRINCIPLES: Array<{ app: string; title: string; body: string[] }> = [
  {
    app: 'APP 1',
    title: 'Open and transparent management of personal information',
    body: [
      'This statement, the Privacy Policy and the Privacy Center are our privacy policy for the purposes of APP 1. They describe what we collect, why, who we share it with, and how to access, correct or complain.',
      'Questions go to the privacy mailbox below and are answered within 30 days.',
    ],
  },
  {
    app: 'APP 3 and APP 5',
    title: 'Collection, and telling you about it',
    body: [
      'We collect what the platform needs to work: your account details, your profile and what you post, your applications and bookings, payment records held by Stripe, and technical logs. Sensitive information (for example, health information in DV Safe Mode, or a document used for identity verification) is collected only with your consent and only for the feature you used it in.',
      'Where information is collected from someone other than you (a referee you named, an employer you applied to), that person is told what it is for.',
    ],
  },
  {
    app: 'APP 6',
    title: 'Use and disclosure',
    body: [
      'Your information is used for the purpose you gave it for, and for related purposes you would reasonably expect: running the platform, keeping members safe, meeting legal obligations. It is not sold.',
      'It is disclosed to providers who act for us (hosting, payments, email, push notifications), to the people you choose to share it with on the platform, and where the law requires it. The current list of providers is published on the subprocessors page.',
    ],
  },
  {
    app: 'APP 7',
    title: 'Direct marketing',
    body: ['Marketing email is opt-in and every message carries an unsubscribe link. You can change every notification kind, including marketing, in Settings, and we act on it at once.'],
  },
  {
    app: 'APP 8',
    title: 'Cross-border disclosure',
    body: [
      'Some of our providers store data outside Australia. Before we rely on one we check that it is bound by contract to protect your information to a standard at least as high as the APPs, and we say where each one operates on the subprocessors page. If you would rather we did not disclose your information overseas, you can close your account and export your data first from the Privacy Center.',
    ],
  },
  {
    app: 'APP 10 and APP 11',
    title: 'Quality and security',
    body: [
      'You can correct your own profile at any time. We protect information with encryption in transit and at rest, access controls, audit logging of privileged actions, and security testing; DV Safe Mode data is additionally encrypted with its own key.',
      'When information is no longer needed for a purpose we are allowed to keep it for, it is deleted or de-identified. Deleting your account removes your personal information within 30 days, apart from records the law requires us to keep.',
    ],
  },
  {
    app: 'APP 12 and APP 13',
    title: 'Access and correction',
    body: [
      'You can see and download everything we hold about you from the Privacy Center, without charge. Where a request needs a person, we answer within 30 days and, if we refuse any part of it, we tell you why and how to complain.',
      'If something we hold is wrong, tell us and we will correct it, or record your statement beside it if we disagree.',
    ],
  },
];

export default function AustralianPrivacyPage() {
  const privacy = contactLink('privacy');
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-start gap-3">
        <Shield className="mt-1 h-8 w-8 flex-shrink-0 text-primary-500" />
        <div>
          <h1 className="text-3xl font-bold">Australian Privacy Statement</h1>
          <p className="mt-2 text-muted-foreground">
            {ORGANISATION.legalName} is incorporated in {ORGANISATION.jurisdiction} and is bound by the Privacy Act 1988 (Cth) and the Australian Privacy Principles. This statement supplements the{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            . Members in the United Kingdom also have the{' '}
            <Link href="/privacy/uk" className="text-primary hover:underline">
              UK Privacy Addendum
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {PRINCIPLES.map((p) => (
          <section key={p.app} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.app}</p>
            <h2 className="mt-1 text-xl font-semibold">{p.title}</h2>
            {p.body.map((paragraph, i) => (
              <p key={i} className="mt-3 text-sm leading-6 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifiable Data Breaches scheme</p>
          <h2 className="mt-1 text-xl font-semibold">If your information is involved in a data breach</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Under Part IIIC of the Privacy Act, if we suspect that personal information has been lost or accessed without authorisation, we assess within 30 days whether it is likely to result in serious harm. If it is, we notify the Office of the Australian Information Commissioner and the people affected as soon as practicable, saying what happened, what information was involved, and what to do. Every incident, notifiable or not, is recorded in our breach register with its containment and remediation steps.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Complaints</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Write to us first at{' '}
            <a href={privacy.href} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Mail className="h-3.5 w-3.5" /> {privacy.label}
            </a>
            . We acknowledge complaints within 7 days and aim to resolve them within 30. If you are not satisfied, you can complain to the Office of the Australian Information Commissioner at{' '}
            <a href="https://www.oaic.gov.au/privacy/privacy-complaints" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              oaic.gov.au <ExternalLink className="h-3.5 w-3.5" />
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          See also the{' '}
          <Link href="/privacy-center" className="text-primary hover:underline">
            Privacy Center
          </Link>{' '}
          to download your data or delete your account, and the{' '}
          <Link href="/cookies" className="text-primary hover:underline">
            Cookie Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
