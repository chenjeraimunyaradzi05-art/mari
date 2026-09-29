'use client';

import { Download } from 'lucide-react';
import { downloadText } from '@/lib/download';
import { cn } from '@/lib/utils';
import { copyFilename, type CopyKind } from './save-copy';

/**
 * "Save a copy": the result as a text file on her device.
 *
 * ATHENA keeps nothing these tools write, and the pages used to end on "note
 * down anything you want to keep", which left copying a whole plan out by hand
 * as the only way to keep it. The text is built when she presses the button,
 * from what is on screen at that moment, and never leaves the browser.
 *
 * The hint says where it goes. On a shared phone or laptop a file in the
 * downloads folder can be found by someone else, and that is hers to weigh
 * before she presses it, not something to discover afterwards.
 */
export default function SaveCopyButton({
  kind,
  build,
  className,
  label = 'Save a copy',
}: {
  kind: CopyKind;
  build: () => string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <button
        type="button"
        onClick={() => downloadText(copyFilename(kind), build())}
        className="btn-outline flex items-center space-x-2"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>{label}</span>
      </button>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Saves a text file to this device. ATHENA does not keep a copy.
      </span>
    </div>
  );
}
