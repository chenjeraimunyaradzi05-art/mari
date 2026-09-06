import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import Markdown, { renderMarkdown } from './Markdown';

describe('Markdown rendering for articles', () => {
  it('turns Markdown into the tags an article needs', () => {
    const html = renderMarkdown('## Heading\n\nA paragraph with **bold** and a [link](/pricing).\n\n- one\n- two\n\n![alt](https://example.com/p.jpg)\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<a href="/pricing">link</a>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<img src="https://example.com/p.jpg" alt="alt">');
    expect(html).toContain('<table>');
  });

  it('never renders raw HTML from the source, and strips anything that runs', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> <img src=x onerror="alert(2)"> <a href="javascript:alert(3)">x</a>\n\n<iframe src="https://evil.example"></iframe>');
    // None of the typed elements survives as an element (the URL in the text is
    // auto-linked, which is a plain anchor and fine).
    expect(html).not.toMatch(/<(script|img|iframe|a href="javascript)/);
    expect(html).not.toMatch(/<[^>]+onerror/);
    expect(html).not.toMatch(/href="javascript:/);
    // The typed tags appear only as escaped text.
    expect(html).toContain('&lt;script&gt;');
  });

  it('refuses a javascript: link written in Markdown and keeps the text', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))');
    expect(html).not.toContain('<a');
    expect(html).toContain('click me');
  });

  it('opens outside links in a new tab without handing over the opener', () => {
    const html = renderMarkdown('[out](https://example.com) and [in](/blog)');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">out</a>');
    expect(html).toContain('<a href="/blog">in</a>');
  });

  it('renders into the page as prose', () => {
    const { container } = render(<Markdown source="Just **words**." />);
    expect(container.querySelector('.prose')).not.toBeNull();
    expect(container.querySelector('strong')).toHaveTextContent('words');
  });
});
