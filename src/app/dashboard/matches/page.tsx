import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { JobMatches } from '@/components/jobs/JobMatches';

export default async function MatchesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // We need the user ID. The type definition for session.user might not have 'id' 
  // if not extended in types/next-auth.d.ts, but the token callback puts it there.
  // We'll cast or assume it's there based on auth.ts logic.
  const userId = (session.user as any).id;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job Matches</h1>
        <p className="text-gray-600 mt-2">
          Jobs curated specifically for your skills and interests.
        </p>
      </div>
      
      <JobMatches userId={userId} />
    </div>
  );
}
