import { fireEvent, render, screen } from '@testing-library/react';
import { ApplicationModal, type ApplicationData } from './ApplicationModal';
import type { Apprenticeship } from './types';

// The upload control talks to the media API; what is under test here is what
// the form sends and what it says when the server refuses.
jest.mock('@/app/jobs/ResumeAttachment', () => ({
  ResumeAttachment: ({ onChange }: { onChange: (value: { url: string; fileName: string }) => void }) => (
    <button type="button" onClick={() => onChange({ url: '/api/media/local/resumes/me/cv.pdf', fileName: 'cv.pdf' })}>
      Attach test résumé
    </button>
  ),
}));

const apprenticeship = {
  id: 'ap1',
  title: 'Electrotechnology apprenticeship',
  rto: { id: 'rto-1', name: 'TAFE Queensland' },
} as unknown as Apprenticeship;

const COVER = 'I have wanted to become an electrician since I rewired my grandmother’s shed, and I want to learn properly.';

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText(/Dear Hiring Team/), { target: { value: COVER } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Attach test résumé' }));
  fireEvent.change(screen.getByPlaceholderText('https://yourportfolio.com'), { target: { value: 'https://mei.example/work' } });
  const date = document.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(date, { target: { value: '2099-02-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit Application' }));
}

describe('Applying for an apprenticeship', () => {
  it('sends the uploaded résumé, the start date and the portfolio link', async () => {
    const onSubmit = jest.fn<Promise<void>, [ApplicationData]>(async () => undefined);
    render(<ApplicationModal isOpen onClose={jest.fn()} apprenticeship={apprenticeship} onSubmit={onSubmit} />);

    fillAndSubmit();

    expect(await screen.findByText(/has been sent/)).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeUrl: '/api/media/local/resumes/me/cv.pdf',
        portfolioUrl: 'https://mei.example/work',
        availableStartDate: '2099-02-01',
      })
    );
    // Nothing ATHENA sends or can promise on a provider's behalf.
    expect(screen.queryByText(/5-7 business days/)).not.toBeInTheDocument();
  });

  it('shows the server’s reason when it refuses, not "please try again"', async () => {
    const onSubmit = jest.fn(async () => {
      throw { response: { status: 409, data: { message: 'This provider has not set up its ATHENA account yet.' } } };
    });
    render(<ApplicationModal isOpen onClose={jest.fn()} apprenticeship={apprenticeship} onSubmit={onSubmit} />);

    fillAndSubmit();

    expect(await screen.findByText('This provider has not set up its ATHENA account yet.')).toBeInTheDocument();
  });
});
