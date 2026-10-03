/**
 * Which requests for `/uploads/<path>` may be answered from this host's disk.
 *
 * Only files in the folders served openly (src/index.ts) are. Résumés and
 * documents are private: they are read through the API by their owner or by
 * hiring staff (routes/media.routes.ts), and must never be reachable by
 * their address alone, whether they sit in the bucket or on this disk.
 */

/**
 * Whether the part of the request after `/uploads`, as the router sees it,
 * names a file in one of the `publicFolders`.
 *
 * The folder is read from the path the way the file server will read it: the
 * path is decoded once, a backslash counts as a slash, and a path with a `.` or
 * `..` segment is refused outright. The check used to take the first segment of
 * the raw text, and the file server resolves `..` after that check has been made,
 * so `/uploads/avatars/..%2fresumes/<id>/cv.pdf` passed as "avatars" and was
 * served from `resumes/`, which is private. Nothing a stranger types may reach
 * a private folder through a public one.
 */
export function isPublicUploadPath(requestPath: string, publicFolders: ReadonlySet<string>): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return false;
  }
  if (decoded.includes('\0')) return false;

  const segments = decoded.split(/[\\/]+/).filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) return false;
  return publicFolders.has(segments[0]);
}
