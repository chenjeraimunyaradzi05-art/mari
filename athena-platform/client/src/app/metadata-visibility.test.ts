/**
 * A post, a profile or a reel must not reach a page's title, description or
 * preview card without the server's visibility rules having been applied to it.
 *
 * Search, the feeds, a topic's page and the saved list all read posts through the
 * API, which holds each one to its author's audience and to the viewer's blocks
 * (see the server's tests/post-visibility.test.ts). A page's metadata is the one
 * place a post's words could leave by another door: `generateMetadata` runs on
 * the server, for a crawler and a link preview that is nobody in particular,
 * and whatever it returns is printed into the page head and cached. A post the
 * author kept private, or a profile she closed, would then be quoted in a link
 * preview to anyone the link was pasted to.
 *
 * Today no page for a post, a profile, a reel, a topic, a group or a live stream
 * has any metadata of its own, and the sitemap lists none of them, so there is
 * nothing to leak. This keeps it that way: it fails if one is added without a
 * line in the file saying the visibility check was made, which is a line a
 * reviewer will read.
 */

import fs from 'fs';
import path from 'path';

const APP = path.resolve(__dirname);

/** The routes whose pages are made of a member's own words or face. */
const MEMBER_CONTENT_ROUTES = ['posts', 'profile', 'videos', 'topics', 'groups', 'live', 'sounds', 'stories', 'mentors', 'communities'];

/** The note that lets a file through: it says where the API's visibility gate is applied. */
const CHECKED = 'metadata-visibility: checked';

function files(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Whether a source file defines metadata that could be built from the thing the page is about. */
export function definesDynamicMetadata(text: string): boolean {
  return /export\s+(async\s+)?function\s+generateMetadata\b/.test(text) || /export\s+const\s+generateMetadata\b/.test(text);
}

describe('page metadata for a member’s own content', () => {
  it('is recognised in the shapes Next.js accepts, and left alone when it is static', () => {
    expect(definesDynamicMetadata('export async function generateMetadata({ params }) {}')).toBe(true);
    expect(definesDynamicMetadata('export function generateMetadata() {}')).toBe(true);
    expect(definesDynamicMetadata('export const generateMetadata = async () => ({})')).toBe(true);
    expect(definesDynamicMetadata("export const metadata = { title: 'Posts' };")).toBe(false);
    expect(definesDynamicMetadata('// generateMetadata is deliberately absent here')).toBe(false);
  });

  it('is not built from a post, a profile or a reel unless the file says the visibility check was made', () => {
    const offences = MEMBER_CONTENT_ROUTES.flatMap((route) => files(path.join(APP, route)))
      .filter((file) => {
        const text = fs.readFileSync(file, 'utf8');
        return definesDynamicMetadata(text) && !text.includes(CHECKED);
      })
      .map((file) => path.relative(APP, file));

    expect(offences).toEqual([]);
  });

  it('reads the app folder, so a missing one cannot make this pass', () => {
    expect(files(path.join(APP, 'posts')).length).toBeGreaterThan(0);
    expect(files(path.join(APP, 'profile')).length).toBeGreaterThan(0);
  });

  it('lists no post, profile or reel in the sitemap', () => {
    const sitemap = fs.readFileSync(path.join(APP, 'sitemap.ts'), 'utf8');

    expect(sitemap).not.toMatch(/['"`]\/(posts|profile|videos|topics)\b/);
  });
});
