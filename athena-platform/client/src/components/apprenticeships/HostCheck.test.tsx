import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * Whether the host of an apprenticeship has been checked, said honestly on the
 * card, the detail page and the apply form.
 *
 * An apprentice is often a young person in a first job. A listing whose host has
 * not been checked is shown, labelled, not hidden, and applications through ATHENA
 * stay shut until the host is verified and its safety attestation approved. The
 * label never reads as a guarantee and never says police or background checks were
 * run, because none are.
 */

jest.mock('@/app/jobs/ResumeAttachment', () => ({ ResumeAttachment: () => <div>resume attachment</div> }));

import { ApplicationModal } from './ApplicationModal';
import { ApprenticeshipCard } from './ApprenticeshipCard';
import { HostCheckBadge, HostCheckNotice, hostChecked } from './HostCheck';
import type { Apprenticeship } from './types';

const listing = (over: Partial<Apprenticeship> = {}): Apprenticeship =>
  ({
    id: 'ap1',
    title: 'Electrotechnology apprenticeship',
    slug: 'electro',
    description: 'Four years on site.',
    framework: 'UEE30820',
    level: 'CERTIFICATE_III',
    durationMonths: 48,
    isRemote: false,
    positions: 2,
    positionsFilled: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    rto: { id: 'rto-1', name: 'TAFE Queensland' },
    hostEmployer: { id: 'host-1', name: 'Brisbane Electrical' },
    ...over,
  }) as Apprenticeship;

const noop = () => undefined;

describe('hostChecked', () => {
  it('is yes, no, or unknown, and unknown is not no', () => {
    expect(hostChecked({ hostMayPlace: true })).toBe(true);
    expect(hostChecked({ hostMayPlace: false })).toBe(false);
    expect(hostChecked({})).toBeNull();
  });
});

describe('The label', () => {
  it('says a checked host is safety-checked, and what that is, without promising more', () => {
    render(<HostCheckBadge apprenticeship={{ hostMayPlace: true }} />);

    const label = screen.getByText('Safety-checked host');
    expect(label.closest('span')?.getAttribute('title')).toContain("host's own statement");
    expect(label.closest('span')?.getAttribute('title')).toContain('does not run or hold police or background checks');
  });

  it('says honestly that an unchecked host has not been checked, and still shows the listing', () => {
    render(<HostCheckBadge apprenticeship={{ hostMayPlace: false }} />);
    expect(screen.getByText('Not yet safety-checked')).toBeInTheDocument();
  });

  it('shows nothing at all when the server has not said, rather than guessing', () => {
    const { container } = render(
      <>
        <HostCheckBadge apprenticeship={{}} />
        <HostCheckNotice apprenticeship={{}} />
      </>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('explains an unchecked host in plain words, as a note', () => {
    render(<HostCheckNotice apprenticeship={{ hostMayPlace: false }} />);
    expect(screen.getByRole('note')).toHaveTextContent('ATHENA has not safety-checked this host yet');
    expect(screen.getByRole('note')).toHaveTextContent('applications through ATHENA are not open');
  });
});

describe('The card', () => {
  it('labels a checked host and lets the member apply', () => {
    const onApply = jest.fn();
    render(<ApprenticeshipCard apprenticeship={listing({ hostMayPlace: true })} onApply={onApply} onBookmark={noop} onShare={noop} />);

    expect(screen.getByText('Safety-checked host')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith('ap1');
  });

  it('labels an unchecked host, switches Apply off, and says why on hover', () => {
    const onApply = jest.fn();
    render(<ApprenticeshipCard apprenticeship={listing({ hostMayPlace: false })} onApply={onApply} onBookmark={noop} onShare={noop} />);

    expect(screen.getByText('Not yet safety-checked')).toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Apply' });
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute('title', expect.stringContaining('has not safety-checked this host yet'));
    fireEvent.click(apply);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('does not switch Apply off for a response that predates the label', () => {
    render(<ApprenticeshipCard apprenticeship={listing()} onApply={noop} onBookmark={noop} onShare={noop} />);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.queryByText(/safety-checked/i)).not.toBeInTheDocument();
  });

  it('carries the label on the compact card too', () => {
    render(<ApprenticeshipCard apprenticeship={listing({ hostMayPlace: false })} variant="compact" onApply={noop} onBookmark={noop} onShare={noop} />);
    expect(screen.getByText('Not yet safety-checked')).toBeInTheDocument();
  });
});

describe('The apply form', () => {
  it('tells the member about an unchecked host before asking for a cover letter, and will not send', () => {
    const onSubmit = jest.fn(async () => undefined);
    render(<ApplicationModal isOpen onClose={noop} apprenticeship={listing({ hostMayPlace: false })} onSubmit={onSubmit} />);

    expect(screen.getByRole('note')).toHaveTextContent('has not safety-checked this host yet');
    // The submit button is on the last step; step through to it.
    fireEvent.change(screen.getByPlaceholderText(/Dear Hiring Team/), {
      target: { value: 'I have wanted to become an electrician since I rewired my grandmother’s shed, and I want to learn properly.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2099-02-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const submit = screen.getByRole('button', { name: 'Submit Application' });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('says a checked host is, and what that means, without making it a guarantee', () => {
    render(<ApplicationModal isOpen onClose={noop} apprenticeship={listing({ hostMayPlace: true })} onSubmit={jest.fn(async () => undefined)} />);
    expect(screen.getByText('Safety-checked host')).toBeInTheDocument();
    expect(screen.getByText(/It is the host's own statement/)).toBeInTheDocument();
  });
});
