import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Skills Marketplace | Athena',
  description: 'Connect with talented women offering professional services. Find experts in design, development, marketing, coaching, and more.',
};

export default function SkillsMarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
