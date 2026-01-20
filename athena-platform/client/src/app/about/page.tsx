import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">About ATHENA</h1>
      <p className="mt-4 text-muted-foreground">
        ATHENA is building a safer, smarter career ecosystem for the nine personas.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn-primary">Join Free</Link>
        <Link href="/pricing" className="btn-outline">View Pricing</Link>
      </div>
    </div>
  );
}
