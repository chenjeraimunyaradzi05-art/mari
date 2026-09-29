'use client';

/**
 * Every housing page, with a way off it that stays in reach.
 *
 * The listings page carried quick exit in its header and nowhere else, and
 * the housing plan carried none, though both are where a woman leaving
 * violence reads about bond help for leaving, the refuge line and the safe
 * listings. A header button scrolls away with the header; this one stays in
 * the corner however far down the listings she has read. It reads the same
 * stored exit address and Escape setting as every other copy, and if the
 * dashboard layout carries a floating exit of its own, only one is drawn.
 */

import type { ReactNode } from 'react';
import { QuickExitButton } from '../safety/QuickExit';

export default function HousingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <QuickExitButton variant="floating" className="print:hidden" />
    </>
  );
}
