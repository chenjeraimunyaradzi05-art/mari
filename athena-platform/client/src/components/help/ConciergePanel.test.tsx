import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConciergePanel from './ConciergePanel';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

import { api } from '@/lib/api';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConciergePanel />
    </QueryClientProvider>
  );
}

describe('ConciergePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockResolvedValue({
      data: {
        suggestions: {
          message: '',
          suggestions: ['Complete your profile to improve job matching by up to 40%'],
          actions: [{ type: 'navigate', label: 'Complete Profile', target: '/dashboard/settings/profile' }],
        },
      },
    });
  });

  it('shows proactive suggestions as chips and links', async () => {
    renderPanel();
    expect(await screen.findByText('Complete Profile')).toHaveAttribute('href', '/dashboard/settings/profile');
    expect(screen.getByText(/Complete your profile to improve job matching/)).toBeInTheDocument();
  });

  it('asks a question and renders the answer with its quick replies', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'Visit the Mentors section in your dashboard.', quickReplies: ['Tell me more'], actions: [{ type: 'navigate', label: 'Open Mentors', target: '/dashboard/mentors' }] } });
    renderPanel();

    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'how do I find a mentor?' } });
    fireEvent.click(screen.getByLabelText('Send'));

    expect(await screen.findByText('Visit the Mentors section in your dashboard.')).toBeInTheDocument();
    expect(screen.getByText('how do I find a mentor?')).toBeInTheDocument();
    expect(screen.getByText('Open Mentors')).toHaveAttribute('href', '/dashboard/mentors');
    expect(screen.getByText('Tell me more')).toBeInTheDocument();
    expect(mockedApi.post).toHaveBeenCalledWith('/concierge/chat', expect.objectContaining({ message: 'how do I find a mentor?', conversationHistory: [] }));
  });

  it('says so when the assistant is unavailable and keeps the question', async () => {
    mockedApi.post.mockRejectedValue({ response: { data: { message: 'Assistant offline' } } });
    renderPanel();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByText('Assistant offline')).toBeInTheDocument());
    expect((screen.getByLabelText('Your question') as HTMLInputElement).value).toBe('hello');
  });
});
