'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/loading';

// Older links and copied share URLs used this path; the directory existed but
// never had a page in it, so every one of them was a 404. The post now lives
// at /posts/:id, which is also public, so this only forwards.
export default function LegacyPostRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) router.replace(`/posts/${params.id}`);
  }, [params?.id, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
