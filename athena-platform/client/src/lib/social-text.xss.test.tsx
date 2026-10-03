import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { renderSocialText } from './social-text';
import { HOSTILE_TEXT, liveMarkupIn } from '@/test-support/xss';

/**
 * renderSocialText draws a post, a comment, a reel caption and a bio. Whatever
 * is typed there is text, apart from the three things it deliberately makes
 * live (a hashtag, a mention, an http link), and none of those can be made to
 * carry markup or a script address.
 */

function draw(text: string) {
  return render(<p>{renderSocialText(text)}</p>);
}

describe('stored text in a post, a comment or a bio', () => {
  it('draws a hostile string as text and nothing else', () => {
    const { container } = draw(`hello ${HOSTILE_TEXT} #tag`);

    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('img[onerror]')).toBeNull();
    // The characters are all there for the reader to see, which is what "as text" means.
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container).toHaveTextContent('<script>alert(2)</script>');
  });

  it('does not turn a javascript: address into a link', () => {
    const { container } = draw('javascript:alert(1) and JaVaScRiPt:alert(2) and https://example.org/ok');

    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://example.org/ok']);
  });

  it('stops a link at the character that would close an attribute or a tag', () => {
    const { container } = draw('see https://example.org/a"onmouseover="alert(1) and https://example.org/b<script>');

    expect(liveMarkupIn(container)).toEqual([]);
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://example.org/a', 'https://example.org/b']);
  });

  it('keeps a mention to the id it was written with, and the name as text', () => {
    const { container } = draw('hi @[<img src=x onerror=alert(1)>](123e4567-e89b-12d3-a456-426614174000)');

    // The bracketed name may not contain a closing bracket or a newline, but a
    // tag is allowed in it: it must still come out as text.
    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/profile/123e4567-e89b-12d3-a456-426614174000');
    expect(container.querySelector('a')).toHaveTextContent('@<img src=x onerror=alert(1)>');
  });

  it('opens outside links without handing the new tab the opener', () => {
    const { container } = draw('https://example.org/');
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });
});
