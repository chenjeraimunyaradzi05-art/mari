import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The public report form. It is the door the Online Safety Act asks for and the
 * one a woman with no account can use, so what it sends has to be something the
 * server can find, and what it says beside "urgent" has to be true.
 */

let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));
jest.mock('@/lib/hooks', () => ({ useAuthStore: () => ({ isAuthenticated: false, isLoading: false }) }));

const post = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { post: (...args: unknown[]) => post(...args) },
  dvSafeApi: { getSettings: jest.fn() },
}));
// Reads the online-safety regimes over the network; not what this is about.
jest.mock('@/components/compliance/OnlineSafetyNotice', () => ({ __esModule: true, default: () => null }));

import ReportContentPage from './page';
import { resetFloatingExitClaims } from '../dashboard/safety/QuickExit';

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9a0b1c2d3e4f';

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (children: ReactNode) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(wrap(<ReportContentPage />));
}

function fillAndSubmit(contentId: string) {
  fireEvent.change(screen.getByLabelText(/link to it, or its id/i), { target: { value: contentId } });
  fireEvent.change(screen.getByLabelText(/please describe the issue/i), { target: { value: 'It threatens me.' } });
  fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
}

beforeEach(() => {
  searchParams = new URLSearchParams();
  post.mockReset();
  post.mockResolvedValue({
    status: 201,
    data: { success: true, message: 'Report submitted.', data: { reference: 'RPT-20261001-ABCDE', reviewDeadline: '2026-10-03T00:00:00.000Z' } },
  });
  act(() => resetFloatingExitClaims());
});

describe('what the form sends', () => {
  it('files a pasted post link as that post, by its ID alone', async () => {
    renderForm();

    fillAndSubmit(`https://athena.example/posts/${ID}`);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/compliance/report-content');
    expect(post.mock.calls[0][1]).toMatchObject({ contentType: 'post', contentId: ID });
  });

  it('files a pasted reel link as a reel, whatever the list was left on', async () => {
    renderForm();
    expect(screen.getByLabelText(/what type of content/i)).toHaveValue('post');

    fillAndSubmit(`https://athena.example/explore?video=${ID}`);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({ contentType: 'video', contentId: ID });
  });

  it('tells her what it read the link as, before she sends it', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/link to it, or its id/i), {
      target: { value: `https://athena.example/profile/${ID}` },
    });

    expect(screen.getByText(/we read this link as a member profile/i)).toBeInTheDocument();
  });

  it('sends a bare ID as the type she chose, including an event or a housing listing', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/what type of content/i), { target: { value: 'housing_listing' } });

    fillAndSubmit(ID);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({ contentType: 'housing_listing', contentId: ID });
  });

  it('keeps a link it cannot read from being filed, and says what to do', async () => {
    renderForm();

    fillAndSubmit('https://athena.example/pricing');

    expect(await screen.findByText(/could not tell what that link is/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    // And the form is still there, with what she typed, rather than a dead end.
    expect(screen.getByLabelText(/link to it, or its id/i)).toHaveValue('https://athena.example/pricing');
    expect(screen.getByRole('button', { name: /submit report/i })).toBeEnabled();
  });

  it('shows the reference the server stamped once the report is filed', async () => {
    renderForm();

    fillAndSubmit(`https://athena.example/jobs/${ID}`);

    expect(await screen.findByText('RPT-20261001-ABCDE')).toBeInTheDocument();
  });

  // The server emails the address a confirmation at intake and the outcome at
  // decision (content-report.service). The field used to say we would write
  // only if we needed more, under a confirmation promising to write with the
  // outcome; it says what happens.
  it('says what her email address is for: a confirmation now, the outcome later, and nobody she reports', () => {
    renderForm();

    const help = screen.getByLabelText(/your email/i).parentElement?.textContent ?? '';

    expect(help).toMatch(/confirmation with your reference number/i);
    expect(help).toMatch(/write again with the outcome/i);
    expect(help).toMatch(/don't share it with anyone you report/i);
    expect(help).not.toMatch(/only contact you if we need/i);
  });
});

/**
 * An intimate image shared without consent, and a threat to hurt someone, had no
 * name here: she had to guess which of "illegal", "harmful" and "harassment" an
 * image of her came under. Both are named and first, and a report of either is
 * answered with where else to turn.
 */
describe('the two reasons that were not named', () => {
  it('lists an intimate image and a threat first, marked as priority', () => {
    renderForm();

    const reasons = screen.getAllByRole('radio', { name: /./ }).filter((radio) => (radio as HTMLInputElement).name === 'reason');
    expect(reasons.slice(0, 2).map((radio) => (radio as HTMLInputElement).value)).toEqual(['intimate_image', 'threat']);
    expect(screen.getByText('Intimate Image Shared Without Consent')).toBeInTheDocument();
    expect(screen.getByText('A Threat to Hurt Someone')).toBeInTheDocument();
  });

  it('files the reason by its own name', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('radio', { name: /Intimate Image Shared Without Consent/ }));
    fillAndSubmit(`https://athena.example/posts/${ID}`);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({ reason: 'intimate_image', contentType: 'post', contentId: ID });
  });

  it('answers a filed intimate-image report with the eSafety Commissioner and the police', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('radio', { name: /Intimate Image Shared Without Consent/ }));
    fillAndSubmit(`https://athena.example/posts/${ID}`);

    expect(await screen.findByRole('link', { name: /Report to the eSafety Commissioner/ })).toHaveAttribute('href', 'https://www.esafety.gov.au/report');
    expect(screen.getByRole('link', { name: /Policelink 131 444/ })).toHaveAttribute('href', 'tel:131444');
    expect(screen.getByText('RPT-20261001-ABCDE')).toBeInTheDocument();
  });

  it('answers a filed threat with 000 first, and says not to wait for us', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('radio', { name: /A Threat to Hurt Someone/ }));
    fillAndSubmit(`https://athena.example/posts/${ID}`);

    expect(await screen.findByText(/call 000 and do not wait for us/)).toBeInTheDocument();
  });

  it('adds nothing to the confirmation of a report that has nowhere else to go', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('radio', { name: /Spam or Unwanted Content/ }));
    fillAndSubmit(`https://athena.example/posts/${ID}`);

    expect(await screen.findByText('RPT-20261001-ABCDE')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /eSafety/ })).not.toBeInTheDocument();
  });
});

describe('the types it offers', () => {
  it('does not offer "other", which has nothing to point at, or a direct message, which is reported from its thread', () => {
    renderForm();

    const options = Array.from(screen.getByLabelText(/what type of content/i).querySelectorAll('option')).map((o) => o.getAttribute('value'));

    expect(options).toEqual(expect.arrayContaining(['post', 'video', 'profile', 'comment', 'job', 'event', 'housing_listing']));
    expect(options).not.toContain('other');
    expect(options).not.toContain('message');
    expect(screen.getByText(/open the conversation and choose Report on the message itself/i)).toBeInTheDocument();
  });

  it('opens on the first type when a link into it names one the form does not file', () => {
    searchParams = new URLSearchParams('type=other');

    renderForm();

    expect(screen.getByLabelText(/what type of content/i)).toHaveValue('post');
  });

  it('honours a link into it that names one it does', () => {
    searchParams = new URLSearchParams(`type=event&contentId=${ID}`);

    renderForm();

    expect(screen.getByLabelText(/what type of content/i)).toHaveValue('event');
    expect(screen.getByLabelText(/link to it, or its id/i)).toHaveValue(ID);
  });
});

describe('beside "urgent"', () => {
  it('says to ring 000 and 1800RESPECT, as links that dial, and that urgent does not bring anyone', () => {
    renderForm();

    const note = screen.getByRole('note');

    expect(note).toHaveTextContent(/in danger now\?/i);
    expect(note.querySelector('a[href="tel:000"]')).not.toBeNull();
    expect(note.querySelector('a[href="tel:1800737732"]')).toHaveTextContent('1800 737 732');
    expect(note).toHaveTextContent(/it does not send anyone to you/i);
  });

  it('carries the quick exit and the Emergency help button', () => {
    renderForm();

    expect(screen.getByRole('button', { name: /quick exit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /emergency help/i })).toBeInTheDocument();
  });
});
