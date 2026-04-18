export default function MentorAgreementPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Mentor Agreement</h1>
      <p className="mt-4 text-muted-foreground">
        The final mentor agreement is issued during mentor approval and onboarding. This page summarizes the core
        commercial and platform expectations mentors should expect before accepting bookings.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Mentor responsibilities</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Maintain accurate availability, pricing, and profile information.</li>
            <li>Deliver sessions professionally and comply with ATHENA safety and conduct standards.</li>
            <li>Handle client information confidentially and only through approved platform workflows.</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Commercial terms</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Payout timing and settlement depend on payment provider configuration and verification status.</li>
            <li>Refunds, disputes, and chargebacks are handled under the platform billing and support policies.</li>
            <li>Mentor access can be paused if safety, compliance, or verification issues remain unresolved.</li>
          </ul>
        </section>
      </div>
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Need the full commercial paper trail? The final agreement, payout terms, and any jurisdiction-specific addenda
        should be reviewed during mentor onboarding before listings go live.
      </div>
    </div>
  );
}
