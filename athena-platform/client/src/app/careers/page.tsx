import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers | ATHENA',
  description: 'Open roles at ATHENA, and how to reach us when there are none listed.',
};

const workingHere = [
  {
    title: 'Small team, wide surface',
    body: 'ATHENA is founder-led and in staged rollout. Whoever joins next will own real product surface from their first week rather than a slice of someone else’s roadmap.',
  },
  {
    title: 'Built with the people who use it',
    body: 'Decisions come from talking to the women on the platform. If you would rather ship from a research deck than from a conversation, this will not suit you.',
  },
  {
    title: 'Honest by default',
    body: 'We do not publish numbers we cannot evidence, in the product or in hiring. What we tell candidates about stage, funding, and pay is what is actually true at the time.',
  },
];

export default function CareersPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Careers</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        There are no open roles listed right now. Rather than leave a placeholder advert up, we
        keep this page empty until a role is real, funded, and ready to interview for.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Open roles</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          None currently. When we open one it will be posted here with the scope, the salary
          band, and the interview process written out before you apply.
        </p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          If you want to be told when that happens, or you think there is a role we should be
          hiring for, email us and say so. We read every one.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary">Get in touch</Link>
          <Link href="/team" className="btn-outline">About the team</Link>
        </div>
      </div>

      <h2 className="mt-12 text-xl font-semibold">What working here looks like</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {workingHere.map((item) => (
          <div key={item.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
