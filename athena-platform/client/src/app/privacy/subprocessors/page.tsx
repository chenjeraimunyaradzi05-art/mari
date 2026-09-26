import Link from 'next/link';
import type { Metadata } from 'next';
import { Server } from 'lucide-react';
import { SubprocessorList } from './SubprocessorList';

export const metadata: Metadata = {
  title: 'Service Providers | ATHENA',
  description: 'The providers who handle personal information for ATHENA, what they do, and where they hold it.',
};

/**
 * The page the Australian Privacy Statement sends members to twice — once
 * under APP 6 for who we disclose to, once under APP 8 for where it goes
 * overseas. It did not exist, so both references pointed nowhere. It reads the
 * subprocessor register the admin console now writes, and when nothing has
 * been published it says so rather than showing an empty table as if there
 * were no providers.
 */
export default function SubprocessorsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-start gap-3">
        <Server className="mt-1 h-8 w-8 flex-shrink-0 text-primary-500" />
        <div>
          <h1 className="text-3xl font-bold">Service providers</h1>
          <p className="mt-2 text-muted-foreground">
            The organisations that handle personal information on ATHENA&apos;s behalf, what each one does, and the
            country it holds data in. This is the list the{' '}
            <Link href="/privacy/au" className="text-primary hover:underline">
              Australian Privacy Statement
            </Link>{' '}
            refers to under APP 6 and APP 8.
          </p>
        </div>
      </div>

      <SubprocessorList />
    </div>
  );
}
