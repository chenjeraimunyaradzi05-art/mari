import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Release notes are blog articles tagged "changelog", published by staff, so
 * the changelog no longer needs a deploy to grow. A failed load must say so:
 * silence would read as "nothing newer than the list below".
 */

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }));

import { CHANGELOG_TAG, ReleaseNotes } from '@/app/changelog/ReleaseNotes';

function renderNotes() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReleaseNotes />
    </QueryClientProvider>
  );
}

describe('ReleaseNotes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists what staff published under the changelog tag, each linking to its full note', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          { id: 'n1', slug: 'october-release', title: 'Reminders the day before', excerpt: 'Events now remind you.', publishedAt: '2026-10-02T00:00:00.000Z' },
        ],
      },
    });

    renderNotes();

    expect(await screen.findByText('Reminders the day before')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read the full note/ })).toHaveAttribute('href', '/blog/october-release');
    expect(mockGet).toHaveBeenCalledWith('/blog', { params: { tag: CHANGELOG_TAG, page: 1, limit: 50 } });
  });

  it('says the latest notes did not load, rather than showing nothing', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));

    renderNotes();

    expect(await screen.findByRole('alert')).toHaveTextContent('The latest release notes did not load');
  });

  it('adds nothing when no note has been published yet', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });

    const { container } = renderNotes();

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('[aria-label="Loading the latest release notes"]')).toBeNull());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
