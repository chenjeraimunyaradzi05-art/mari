'use client';

/**
 * The public housing guide, with a way off it.
 *
 * This page is open to anyone, and it is where a woman who has not signed up
 * yet reads the bond help each state gives for leaving violence and the
 * refuge line beneath it — reading it on a shared computer, perhaps. It had
 * no exit at all. The button needs no account: signed out, it leaves for the
 * default harmless page.
 */

import type { ReactNode } from 'react';
import { QuickExitButton } from '../dashboard/safety/QuickExit';
import { EmergencyHelp } from '@/components/safety/EmergencyHelp';

export default function PublicHousingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <QuickExitButton variant="floating" className="print:hidden" />
      <EmergencyHelp className="print:hidden" />
    </>
  );
}
