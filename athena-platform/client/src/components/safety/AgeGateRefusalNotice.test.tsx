import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * The notice that turns a bare age refusal into a way forward. It appears only
 * when the app announces one, says the server's own sentence, links a member with
 * no date of birth to the form that collects it and an under-age one to us, stays
 * until dismissed, and is one notice however many requests were refused at once.
 */

import { AgeGateRefusalNotice } from './AgeGateRefusalNotice';
import { announceAgeGateCleared, announceAgeGateRefusal } from '@/lib/age-gate-refusal';

const MISSING = {
  kind: 'DATE_REQUIRED' as const,
  message: 'Please add your date of birth before using this part of ATHENA.',
  setup: '/dashboard/settings/profile',
};
const UNDERAGE = {
  kind: 'UNDER_AGE' as const,
  message: 'ATHENA accounts are for adults, so this part of the platform is not available on your account.',
  setup: '/contact',
};

describe('AgeGateRefusalNotice', () => {
  it('shows nothing until a refusal is announced', () => {
    render(<AgeGateRefusalNotice />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the sentence and links to the form that collects her date of birth', () => {
    render(<AgeGateRefusalNotice />);

    act(() => announceAgeGateRefusal(MISSING));

    expect(screen.getByRole('alert')).toHaveTextContent(MISSING.message);
    expect(screen.getByRole('link', { name: 'Add my date of birth' })).toHaveAttribute('href', '/dashboard/settings/profile');
  });

  it('sends an under-age account to us, and not to a form it cannot fill in', () => {
    render(<AgeGateRefusalNotice />);

    act(() => announceAgeGateRefusal(UNDERAGE));

    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('link', { name: 'Add my date of birth' })).not.toBeInTheDocument();
  });

  it('is one notice however many requests were refused, showing the latest', () => {
    render(<AgeGateRefusalNotice />);

    act(() => {
      announceAgeGateRefusal(MISSING);
      announceAgeGateRefusal(MISSING);
      announceAgeGateRefusal(UNDERAGE);
    });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('for adults');
  });

  it('stays until she dismisses it, and then goes', () => {
    render(<AgeGateRefusalNotice />);
    act(() => announceAgeGateRefusal(MISSING));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('goes once her date of birth has been saved, because it would be asking for what she has just given', () => {
    render(<AgeGateRefusalNotice />);
    act(() => announceAgeGateRefusal(MISSING));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => announceAgeGateCleared());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not go for an under-age account: a saved date of birth does not answer that', () => {
    render(<AgeGateRefusalNotice />);
    act(() => announceAgeGateRefusal(UNDERAGE));

    act(() => announceAgeGateCleared());

    expect(screen.getByRole('alert')).toHaveTextContent('for adults');
  });

  it('has thumb-sized controls with a focus ring', () => {
    render(<AgeGateRefusalNotice />);
    act(() => announceAgeGateRefusal(MISSING));

    expect(screen.getByRole('link', { name: 'Add my date of birth' }).className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByRole('link', { name: 'Add my date of birth' }).className).toMatch(/focus-visible:ring-2/);
    expect(screen.getByRole('button', { name: 'Dismiss this notice' }).className).toMatch(/h-11 w-11/);
  });
});
