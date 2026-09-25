'use client';

/**
 * The résumé picker on a job application, shared by the public job page and the
 * dashboard one.
 *
 * Both apply screens told the applicant her résumé would be shared with the
 * employer, and neither of them ever sent one. The API has always accepted
 * `resumeUrl` on an application, the candidate tracker and the employer
 * pipeline both draw a "download résumé" button, and `POST /media/resume`
 * has always existed — the only missing piece was a control on the two screens
 * that make the promise, so `JobApplication.resumeUrl` was null for every
 * application ever submitted and the download buttons never rendered. The
 * employer read a cover letter and nothing else.
 *
 * The file is uploaded before the application is submitted rather than with
 * it, because the upload endpoint takes multipart and the apply endpoint takes
 * JSON. That means an applicant who abandons the modal after choosing a file
 * leaves an orphan in private storage; the alternative was holding the bytes in
 * memory and posting them twice, and an unreferenced private file nobody can
 * read is the cheaper of the two problems.
 */

import { useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { mediaApi } from '@/lib/api';

/** Mirrors FILE_CONFIGS.resume in server/src/routes/media.routes.ts. */
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ACCEPTED_RESUME_TYPES = '.pdf,.doc,.docx';

export interface ResumeAttachmentValue {
  url: string;
  fileName: string;
}

interface ResumeAttachmentProps {
  value: ResumeAttachmentValue | null;
  onChange: (value: ResumeAttachmentValue | null) => void;
  /** Blocks the control while the application itself is being submitted. */
  disabled?: boolean;
}

function errorText(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || 'That file could not be uploaded. Try again.';
}

export function ResumeAttachment({ value, onChange, disabled = false }: ResumeAttachmentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploadError(null);

    // Checked here as well as on the server so a woman on a phone connection
    // is not made to upload ten megabytes before being told it is too big.
    if (file.size > MAX_RESUME_BYTES) {
      setUploadError('That file is larger than 10MB. Try a smaller PDF or Word document.');
      return;
    }

    setIsUploading(true);
    try {
      const response = await mediaApi.uploadResume(file);
      const data = (response.data?.data ?? {}) as { url?: string; fileName?: string };
      if (!data.url) {
        throw new Error('No file link came back');
      }
      onChange({ url: data.url, fileName: data.fileName || file.name });
    } catch (error) {
      setUploadError(errorText(error));
    } finally {
      setIsUploading(false);
      // Cleared so choosing the same file again after an error still fires
      // onChange; a file input does not re-emit an unchanged value.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Résumé (optional)
      </span>

      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <span className="truncate">{value.fileName}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setUploadError(null);
              onChange(null);
            }}
            disabled={disabled}
            className="flex flex-shrink-0 items-center gap-1 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 transition hover:border-primary disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Attach a résumé — PDF or Word, up to 10MB
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_RESUME_TYPES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {uploadError && (
        <p className="text-sm text-red-600" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
