import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apprenticeships | Athena',
  description: 'Launch your career with hands-on apprenticeship programs designed for women. Earn while you learn and gain industry-recognized certifications.',
};

export default function ApprenticeshipsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
