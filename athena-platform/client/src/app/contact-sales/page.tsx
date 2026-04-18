export default function ContactSalesPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Contact Sales</h1>
      <p className="mt-4 text-muted-foreground">
        ATHENA is still in staged rollout. If you want enterprise access, procurement support, or a pricing
        discussion, contact the team directly and include your organisation name, headcount, and intended use case.
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Sales contact</p>
        <a className="mt-2 inline-block text-lg font-semibold text-primary hover:underline" href="mailto:sales@athena.com">
          sales@athena.com
        </a>
        <p className="mt-3 text-sm text-muted-foreground">
          Enterprise onboarding, pilots, and security or procurement questionnaires are handled over email at this
          stage.
        </p>
      </div>
    </div>
  );
}
