import Link from 'next/link';

export default function MentorsMarketingPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Mentors</h1>
      <p className="mt-4 text-muted-foreground">
        Find mentors, book sessions, and accelerate your career.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/dashboard/mentors" className="btn-primary">Find a Mentor</Link>
        <Link href="/dashboard/mentors/become-mentor" className="btn-outline">Become a Mentor</Link>
      </div>
    </div>
  );
}
