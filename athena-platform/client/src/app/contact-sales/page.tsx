import Link from 'next/link';
import { contactLink } from '@/lib/contact';
import LeadForm from '@/components/marketing/LeadForm';

type ContactSalesPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

type Copy = {
  heading: string;
  intro: string;
  contactLabel: string;
  note: string;
  submitLabel: string;
  /** The self-serve door, when one exists: shown first, because it is faster than a conversation. */
  selfServe?: { label: string; href: string; blurb: string };
};

const FUNDING_COPY: Copy = {
  heading: 'Apply for Funding',
  intro:
    'ATHENA capital access is still in staged rollout. There is no self-serve application yet, so funding requests go to the team directly. Include your business name, stage, what you are raising for, and the amount you need.',
  contactLabel: 'Funding contact',
  note: 'Applications are reviewed manually at this stage. Expect a follow-up asking for trading history and identity documents before any capital discussion.',
  submitLabel: 'Send funding enquiry',
};

const GRANTS_COPY: Copy = {
  heading: 'List a grant programme',
  intro:
    'Grant programmes on ATHENA are entered from the funder’s published page, so nothing invented is shown to a founder. Tell us the programme name, who is eligible (stage, industry, state), the closing date or that it is rolling, the funding range and the official link to apply.',
  contactLabel: 'Grants contact',
  note: 'We list what you send within a few days and point every applicant to your official page. Queensland and national programmes are both welcome.',
  submitLabel: 'Send programme details',
};

const APPRENTICESHIPS_COPY: Copy = {
  heading: 'List an apprenticeship',
  intro:
    'An RTO, TAFE or host employer lists apprenticeships itself: create your organisation, then add and publish listings from its page. Applicants, milestones and sign-off all run from there. This form is for a conversation first.',
  contactLabel: 'Apprenticeships contact',
  note: 'Tell us the trades and qualification levels you offer, where the placements are, and roughly how many positions a year.',
  submitLabel: 'Send apprenticeship enquiry',
  selfServe: { label: 'Create your organisation', href: '/employer/organizations/new', blurb: 'Takes a few minutes. Your first listing can go up today.' },
};

const VENDORS_COPY: Copy = {
  heading: 'Join the vendor directory',
  intro:
    'Accountants, lawyers, designers, developers and other suppliers register themselves. An admin checks the ABN and the website, and the listing goes public once it has been verified; you can pitch for briefs meanwhile.',
  contactLabel: 'Vendors contact',
  note: 'Use this form if you would rather talk before registering, or if you want to discuss a partner listing with a member discount.',
  submitLabel: 'Send vendor enquiry',
  selfServe: { label: 'Register your business', href: '/dashboard/vendors#your-vendor', blurb: 'Sign in, fill in one form, and we take it from there.' },
};

const PARTNERS_COPY: Copy = {
  heading: 'Partner with ATHENA',
  intro:
    'Most partners list themselves: a workshop, a practice, a supplier, an apprenticeship provider, an employer, a mentor or a place to rent each has its own door on the site. If you are none of those, or you want to talk about something bigger, tell us here.',
  contactLabel: 'Partnerships contact',
  note: 'Say who you are, who you serve, and what you would like to do together. We reply within a few days.',
  submitLabel: 'Send partnership enquiry',
};

const SALES_COPY: Copy = {
  heading: 'Contact Sales',
  intro:
    'ATHENA is still in staged rollout. If you want enterprise access, procurement support, or a pricing discussion, contact the team directly and include your organisation name, headcount, and intended use case.',
  contactLabel: 'Sales contact',
  note: 'Enterprise onboarding, pilots, and security or procurement questionnaires are handled over email at this stage.',
  submitLabel: 'Send enquiry',
};

// The intent is carried into the lead as its interest, so /admin/marketing/leads
// can tell a TAFE wanting to list apprenticeships from an enterprise pricing
// enquiry. Anything unknown is a sales enquiry.
const INTENTS: Record<string, Copy> = {
  funding: FUNDING_COPY,
  grants: GRANTS_COPY,
  apprenticeships: APPRENTICESHIPS_COPY,
  vendors: VENDORS_COPY,
  partners: PARTNERS_COPY,
  partnership: PARTNERS_COPY,
};

// The self-serve doors a would-be partner might be looking for, for the
// partnership intent: a short list, one line each.
const PARTNER_DOORS = [
  { label: 'List your workshop', href: '/dashboard/cars/workshop' },
  { label: 'List your practice', href: '/dashboard/wellness/practice' },
  { label: 'Register your business as a supplier', href: '/dashboard/vendors#your-vendor' },
  { label: 'List an apprenticeship', href: '/employer/organizations/new' },
  { label: 'Post a job', href: '/employer/organizations/new' },
  { label: 'Mentor', href: '/dashboard/mentors/become-mentor' },
  { label: 'List a place to rent', href: '/dashboard/housing#list-a-place' },
];

export default async function ContactSalesPage({ searchParams }: ContactSalesPageProps) {
  const salesLink = contactLink('sales');
  const { intent } = await searchParams;
  const known = intent && INTENTS[intent] ? intent : null;
  const copy = known ? INTENTS[known] : SALES_COPY;
  const interest = known === 'partnership' ? 'partners' : known ?? 'sales';

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{copy.heading}</h1>
      <p className="mt-4 text-muted-foreground">{copy.intro}</p>
      {copy.selfServe && (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="text-sm font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">The quick way</p>
          <Link href={copy.selfServe.href} className="mt-2 inline-block text-lg font-semibold text-rose-600 hover:underline dark:text-rose-400">
            {copy.selfServe.label}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">{copy.selfServe.blurb}</p>
        </div>
      )}
      {interest === 'partners' && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Already have a door</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PARTNER_DOORS.map((door) => (
              <li key={door.label}>
                <Link href={door.href} className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">
                  {door.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{copy.contactLabel}</p>
        <a className="mt-2 inline-block text-lg font-semibold text-rose-600 hover:underline dark:text-rose-400" href={salesLink.href}>
          {salesLink.label}
        </a>
        <p className="mt-3 text-sm text-muted-foreground">{copy.note}</p>
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Or leave your details here</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Goes straight to the team. Same thing as the email, without opening your mail client.</p>
        <LeadForm source="CONTACT_SALES" fixedInterest={interest} submitLabel={copy.submitLabel} />
      </div>
    </div>
  );
}
