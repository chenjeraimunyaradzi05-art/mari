import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * The saved copy of a draft is labelled with what the draft was written for.
 * The form stays editable beside the draft, so labelling it from the form would
 * let a copy name a topic the draft was never about.
 */

const mockMutate = jest.fn();
jest.mock('@/lib/hooks', () => ({
  useContentGenerator: () => ({ mutate: mockMutate, isPending: false }),
}));

jest.mock('@/lib/download', () => ({
  downloadText: jest.fn(),
}));

jest.mock('../PremiumGate', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import ContentGeneratorPage from './page';
import { downloadText } from '@/lib/download';

const download = downloadText as unknown as jest.Mock;

describe('Content generator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves the draft under the topic it was written for', async () => {
    mockMutate.mockImplementation((_vars: unknown, opts: { onSuccess: (data: unknown) => void }) =>
      opts.onSuccess({ content: 'Six months back at work, and here is what I learned.', simulated: false })
    );
    render(<ContentGeneratorPage />);

    const topic = screen.getByPlaceholderText(/I just got promoted/);
    fireEvent.change(topic, { target: { value: 'Returning to work' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Content/ }));
    expect(await screen.findByText('Six months back at work, and here is what I learned.')).toBeInTheDocument();

    // She starts typing the next topic before saving this one.
    fireEvent.change(topic, { target: { value: 'Something else entirely' } });
    fireEvent.click(screen.getByRole('button', { name: /Save a copy/ }));

    const [filename, text] = download.mock.calls[0];
    expect(filename).toMatch(/^athena-draft-\d{4}-\d{2}-\d{2}\.txt$/);
    expect(text).toContain('Topic: Returning to work');
    expect(text).not.toContain('Something else entirely');
    expect(text).toContain('Six months back at work, and here is what I learned.');
  });

  it('offers nothing to save when nothing was written', async () => {
    mockMutate.mockImplementation((_vars: unknown, opts: { onSuccess: (data: unknown) => void }) =>
      opts.onSuccess({ content: '', simulated: true })
    );
    render(<ContentGeneratorPage />);

    const topic = screen.getByPlaceholderText(/I just got promoted/);
    fireEvent.change(topic, { target: { value: 'Returning to work' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Content/ }));

    expect(await screen.findByText(/not connected to its AI model/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save a copy/ })).not.toBeInTheDocument();
  });
});
