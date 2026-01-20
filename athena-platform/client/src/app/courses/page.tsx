import Link from 'next/link';

export default function CoursesPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Courses</h1>
      <p className="mt-4 text-muted-foreground">
        Explore learning paths and skill-building programs.
      </p>
      <div className="mt-8">
        <Link href="/dashboard/learn" className="btn-primary">Go to Learning Hub</Link>
      </div>
    </div>
  );
}
