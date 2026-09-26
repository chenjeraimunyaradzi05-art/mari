'use client';

/**
 * Every wellness page, with a way off it.
 *
 * Quick exit reached four pages — safety, housing, the DV safety plan and the
 * safety centre — each wired by hand. The wellness pages were not among them,
 * though they are where the crisis lines sit, where the forums are that a
 * woman writes in about what is happening at home, and where her mood and
 * medication records are. Someone walking in behind her while she read any
 * of those found a page she had no fast way to leave.
 *
 * A layout rather than a line in each page, so a wellness page added next
 * month has it without anyone remembering to. The button floats because
 * these pages have no shared header with room for it, and it reads the same
 * stored exit address and Escape setting as every other page that carries it.
 */

import type { ReactNode } from 'react';
import { QuickExitButton } from '../safety/QuickExit';

export default function WellnessLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <QuickExitButton variant="floating" className="print:hidden" />
    </>
  );
}
