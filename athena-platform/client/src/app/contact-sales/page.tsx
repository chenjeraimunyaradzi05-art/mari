type ContactSalesPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

const FUNDING_COPY = {
  heading: 'Apply for Funding',
  intro:
    'ATHENA capital access is still in staged rollout. There is no self-serve application yet, so funding requests go to the team directly. Include your business name, stage, what you are raising for, and the amount you need.',
  contactLabel: 'Funding contact',
  note: 'Applications are reviewed manually at this stage. Expect a follow-up asking for trading history and identity documents before any capital discussion.',
};

const SALES_COPY = {
  heading: 'Contact Sales',
  intro:
    'ATHENA is still in staged rollout. If you want enterprise access, procurement support, or a pricing discussion, contact the team directly and include your organisation name, headcount, and intended use case.',
  contactLabel: 'Sales contact',
  note: 'Enterprise onboarding, pilots, and security or procurement questionnaires are handled over email at this stage.',
};

export default async function ContactSalesPage({ searchParams }: ContactSalesPageProps) {
  const { intent } = await searchParams;
  const copy = intent === 'funding' ? FUNDING_COPY : SALES_COPY;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{copy.heading}</h1>
      <p className="mt-4 text-muted-foreground">{copy.intro}</p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{copy.contactLabel}</p>
        <a className="mt-2 inline-block text-lg font-semibold text-primary hover:underline" href="mailto:sales@athena.com">
          sales@athena.com
        </a>
        <p className="mt-3 text-sm text-muted-foreground">{copy.note}</p>
      </div>
    </div>
  );
}
