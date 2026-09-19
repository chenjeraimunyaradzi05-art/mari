/**
 * Private uploads: a résumé, a document. They live in a private folder and
 * the URL the upload hands back is not a link a browser can follow: a local
 * file is served by GET /api/media/local/<key>, which needs the session
 * header, and an S3 file needs a signed URL. POST /api/media/download-url
 * mints access for whoever may read the file (the owner, or a team member of
 * the organisation an application went to), and this is the client side of
 * that.
 */

import { api, mediaApi } from './api';
import { downloadBlob } from './download';
import { safeHref } from './safe-href';

/**
 * The storage key inside one of our private-upload URLs
 * ("resumes/<userId>/<file>"), or null when the URL is not one: an external
 * link someone typed by hand has no key to mint access for.
 */
export function uploadKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:^|\/)((?:resumes|documents)\/[^/?#]+\/[^/?#]+)(?:[?#]|$)/);
  return match ? match[1] : null;
}

/**
 * Hands the reader a private upload. A local file comes through the API with
 * the session attached and is offered as a download; an S3 file opens by its
 * signed URL. A URL that is not one of ours is opened as it is, when it is a
 * link at all.
 */
export async function downloadPrivateUpload(url: string, fallbackName = 'file'): Promise<void> {
  if (typeof window === 'undefined') return;

  const key = uploadKeyFromUrl(url);
  if (!key) {
    const href = safeHref(url);
    if (!href) throw new Error('That link cannot be opened');
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }

  const minted = await mediaApi.downloadUrl(key);
  const data = (minted.data?.data ?? {}) as { downloadUrl?: string; fileName?: string };
  const downloadUrl = data.downloadUrl;
  if (!downloadUrl) throw new Error('No download link came back');
  const fileName = data.fileName || key.split('/').pop() || fallbackName;

  if (downloadUrl.includes('/api/media/local/')) {
    // The server's own path, taken through the same proxy as every other
    // call so the session header travels with it (the route is bearer-only;
    // a navigation to it never carried one).
    const localPath = new URL(downloadUrl, window.location.origin).pathname.replace(/^\/api/, '');
    const file = await api.get(localPath, { responseType: 'blob' });
    downloadBlob(fileName, file.data as Blob);
    return;
  }

  const opened = window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(downloadUrl);
}
