import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { LinkPreviewCard } from './LinkPreviewCard';
import { HOSTILE_TEXT, HOSTILE_URLS, liveMarkupIn } from '@/test-support/xss';

/**
 * A link preview is the one place a post shows text that neither the author nor
 * a member of ATHENA wrote: the title, description and site name come from
 * whatever page the link points at, fetched by the server. A stranger's web
 * page is therefore in control of every string here.
 */

describe('a link preview built from a stranger\'s web page', () => {
  it('draws the title, description and site name as text', () => {
    const { container } = render(
      <LinkPreviewCard
        preview={{
          url: 'https://example.org/page',
          title: HOSTILE_TEXT,
          description: HOSTILE_TEXT,
          siteName: HOSTILE_TEXT,
          image: null,
        }}
      />
    );

    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
  });

  it.each(HOSTILE_URLS)('does not link to %s', (url) => {
    const { container } = render(
      <LinkPreviewCard preview={{ url, title: 'A page', description: null, siteName: null, image: null }} />
    );

    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
  });

  it('opens a real link in a new tab without the opener', () => {
    const { container } = render(
      <LinkPreviewCard preview={{ url: 'https://example.org/page', title: 'A page', description: null, siteName: null, image: null }} />
    );
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://example.org/page');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });
});
