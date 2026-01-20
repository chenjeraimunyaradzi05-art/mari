import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore | Athena',
  description: 'Discover inspiring video content from women leaders, entrepreneurs, and mentors.',
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
