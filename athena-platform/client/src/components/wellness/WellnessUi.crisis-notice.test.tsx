import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

/**
 * The notice a woman is shown when words she wrote sounded like crisis. It sits at
 * the top of a long page and the form she wrote in is further down, so it has to
 * come into view on its own: a notice above the fold of a page she has scrolled
 * is not "where she is looking".
 */

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { CrisisNotice, crisisOf } from './WellnessUi';

const LINES = [
  { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Crisis support' },
];

describe('CrisisNotice', () => {
  const original = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  it('says what the server said, shows the lines, and brings itself into view', () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<CrisisNotice crisis={{ flagged: true, message: 'It sounds like things are very hard right now. Your check-in is saved.', lines: LINES }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Your check-in is saved.');
    expect(screen.getAllByText(/13 11 14/).length).toBeGreaterThan(0);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('shows nothing, and scrolls nowhere, for calm words', () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { container } = render(<CrisisNotice crisis={{ flagged: false }} />);

    expect(container).toBeEmptyDOMElement();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('still renders where the browser has no scrollIntoView', () => {
    // jsdom has none; some embedded webviews are no better.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).scrollIntoView = undefined;

    render(<CrisisNotice crisis={{ flagged: true, message: 'Hard right now.', lines: LINES }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Hard right now.');
  });

  it('reads the answer off an API response, and only when it was flagged', () => {
    expect(crisisOf({ data: { data: { crisis: { flagged: true, message: 'm', lines: [] } } } })).toMatchObject({ flagged: true });
    expect(crisisOf({ data: { data: { crisis: { flagged: false } } } })).toBeNull();
    expect(crisisOf(undefined)).toBeNull();
  });
});
