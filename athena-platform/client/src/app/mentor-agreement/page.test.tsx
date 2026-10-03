import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MentorAgreementPage from './page';
import { MENTOR_PLATFORM_FEE_PERCENT, MINIMUM_PAYOUT_AUD } from '@/lib/pricing';

/**
 * What a mentor is told about being paid. The Terms put the A$50 payout minimum
 * in the creator section, so a mentor reading only this page had nothing to say
 * whether it applied to her. It does not: the minimum is for creator gifts, and
 * a mentor's withdrawal has none from ATHENA. This page says both, with the
 * figures the code uses.
 */
describe('the mentor agreement, on being paid', () => {
  it('says ATHENA sets no minimum on a mentor withdrawal and that the creator minimum is for gifts only', () => {
    render(<MentorAgreementPage />);

    const line = screen.getByText(/sets no minimum on what you can withdraw/);
    expect(line.textContent).toMatch(/takes no fee when you do/);
    expect(line.textContent).toContain(`A$${MINIMUM_PAYOUT_AUD} minimum in the Terms is for creator gifts only`);
    expect(line.textContent).toMatch(/Stripe pays your bank on the schedule\s+it sets/);
  });

  it('still says what ATHENA keeps of a session, from the price book', () => {
    render(<MentorAgreementPage />);

    expect(screen.getByText(new RegExp(`ATHENA keeps ${MENTOR_PLATFORM_FEE_PERCENT}% of each paid session`))).toBeInTheDocument();
  });
});
