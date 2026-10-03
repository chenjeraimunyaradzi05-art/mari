import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * The notice that turns a bare refusal into a way forward. It appears only
 * when the app announces a women-only refusal, says the server's own sentence,
 * links to the page that fixes it (or to the appeal, for a member a reviewer
 * refused), stays until dismissed, and is one notice however many refusals
 * arrive.
 */

import { WomanGateRefusalNotice } from './WomanGateRefusalNotice';
import { announceWomanGateRefusal } from '@/lib/woman-gate-refusal';

const REQUIRED = {
  kind: 'REQUIRED' as const,
  message: 'This part of ATHENA is open to members who have completed the women-only check.',
  setup: '/dashboard/settings/profile',
};
const REJECTED = {
  kind: 'REJECTED' as const,
  message: 'Your membership did not pass the women-only check. If you believe that is wrong, appeal from Settings.',
  setup: '/help/appeal',
};

describe('WomanGateRefusalNotice', () => {
  it('shows nothing until a refusal is announced', () => {
    render(<WomanGateRefusalNotice />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the sentence and links to where she can complete the check', () => {
    render(<WomanGateRefusalNotice />);

    act(() => announceWomanGateRefusal(REQUIRED));

    expect(screen.getByRole('alert')).toHaveTextContent(REQUIRED.message);
    expect(screen.getByRole('link', { name: 'Complete the women-only check' })).toHaveAttribute('href', '/dashboard/settings/profile');
  });

  it('sends a refused member to the appeal and does not ask her to complete the check again', () => {
    render(<WomanGateRefusalNotice />);

    act(() => announceWomanGateRefusal(REJECTED));

    expect(screen.getByRole('link', { name: 'Appeal this decision' })).toHaveAttribute('href', '/help/appeal');
    expect(screen.queryByRole('link', { name: 'Complete the women-only check' })).not.toBeInTheDocument();
  });

  it('is one notice however many requests were refused, showing the latest', () => {
    render(<WomanGateRefusalNotice />);

    act(() => {
      announceWomanGateRefusal(REQUIRED);
      announceWomanGateRefusal(REQUIRED);
      announceWomanGateRefusal(REJECTED);
    });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('did not pass');
  });

  it('stays until she dismisses it, with a button that has a name and a thumb-sized target', () => {
    render(<WomanGateRefusalNotice />);
    act(() => announceWomanGateRefusal(REQUIRED));

    const dismiss = screen.getByRole('button', { name: 'Dismiss this notice' });
    expect(dismiss.className).toMatch(/h-11/);
    fireEvent.click(dismiss);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stops listening when it goes away', () => {
    const { unmount } = render(<WomanGateRefusalNotice />);
    unmount();
    expect(() => act(() => announceWomanGateRefusal(REQUIRED))).not.toThrow();
  });
});
