'use client';

import { useMemo } from 'react';
import { qrModules } from '@/lib/qr-code';

/**
 * The authenticator setup link as a picture a phone can scan.
 *
 * Drawn here from the link itself (see lib/qr-code.ts for why it is not fetched
 * from anywhere), on a white square with the quiet border a scanner needs even
 * in dark mode, where a QR code on a dark page cannot be read. Draws nothing,
 * and says nothing, when the link is too long for the encoder: the written key
 * and the link beside it always work, so the picture is a convenience and the
 * screen never depends on it.
 */
export function QrCode({ value, label, size = 176 }: { value: string; label: string; size?: number }) {
  const modules = useMemo(() => qrModules(value), [value]);
  if (!modules) return null;

  const quiet = 4;
  const side = modules.length + quiet * 2;
  let path = '';
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    });
  });

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${side} ${side}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="max-w-full rounded-lg border border-slate-200 bg-white"
    >
      <rect width={side} height={side} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
