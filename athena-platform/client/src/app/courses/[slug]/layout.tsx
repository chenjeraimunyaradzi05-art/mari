/**
 * Link previews for a course: its title, provider and description.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const revalidate = 600;

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

type Course = { slug: string; title: string; description: string; providerName?: string | null; organization?: { name?: string | null } | null };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${apiOrigin}/api/courses/${encodeURIComponent(slug)}`, { next: { revalidate } });
    if (!res.ok) return { title: 'Course not found | ATHENA', robots: { index: false } };
    const course = ((await res.json()) as { data?: Course }).data;
    if (!course) return { title: 'Course not found | ATHENA', robots: { index: false } };
    const provider = course.providerName || course.organization?.name;
    const description = course.description.length > 200 ? `${course.description.slice(0, 197).trimEnd()}…` : course.description;
    const title = provider ? `${course.title} · ${provider}` : course.title;
    return {
      title: `${title} | ATHENA`,
      description,
      alternates: { canonical: `/courses/${course.slug}` },
      openGraph: { type: 'website', title, description, url: `/courses/${course.slug}` },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return { title: 'Courses | ATHENA' };
  }
}

export default function CourseLayout({ children }: { children: ReactNode }) {
  return children;
}
