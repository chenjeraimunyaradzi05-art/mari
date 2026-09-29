import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * On a course with a provider and a fee, the lessons wait for the provider to
 * confirm her place. The panel has to say who takes the fee (the provider,
 * never ATHENA), say what asking shares before she asks, and send the request
 * only from the button that said so.
 */

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { CoursePlacePanel, waitsForProvider, type CourseAccess } from '@/app/courses/CoursePlacePanel';

const access = (over: Partial<CourseAccess>): CourseAccess => ({
  requiresAdmission: true,
  lessonsOpen: false,
  admitted: false,
  place: null,
  reason: 'NOT_REQUESTED',
  ...over,
});

function renderPanel(a: CourseAccess) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CoursePlacePanel courseId="c1" provider="Northside TAFE" cost={1200} access={a} />
    </QueryClientProvider>
  );
}

describe('CoursePlacePanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('says who takes the fee and what asking shares, before she asks', async () => {
    mockPost.mockResolvedValue({ data: { data: { access: access({ reason: 'AWAITING_PROVIDER' }) } } });
    renderPanel(access({}));

    expect(screen.getByText(/Northside TAFE charges \$1,200 for this course/)).toBeInTheDocument();
    expect(screen.getByText(/ATHENA does not take payment for courses/)).toBeInTheDocument();
    expect(screen.getByText(/your name, email address, photo and headline/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Northside TAFE for a place' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/courses/c1/enroll', { requestPlace: true }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows a request that is waiting, with nothing to press that would send another', () => {
    renderPanel(access({ reason: 'AWAITING_PROVIDER', place: { applicationId: 'a1', status: 'SUBMITTED' } }));

    expect(screen.getByRole('status')).toHaveTextContent('You have asked Northside TAFE for a place');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Follow your request' })).toHaveAttribute('href', '/dashboard/learn/applications');
  });

  it('opens the classroom for a place already confirmed, without filing a request', async () => {
    mockPost.mockResolvedValue({ data: { data: { access: access({ reason: 'ADMITTED', admitted: true, lessonsOpen: true }) } } });
    renderPanel(access({ reason: 'ADMITTED', admitted: true }));

    fireEvent.click(screen.getByRole('button', { name: /Open the classroom/ }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/courses/c1/enroll', { requestPlace: false }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/learn/c1/classroom'));
  });

  it('lets her ask again after a refusal', () => {
    renderPanel(access({ reason: 'NOT_OFFERED', place: { applicationId: 'a1', status: 'REJECTED' } }));
    expect(screen.getByRole('button', { name: /Ask again/ })).toBeInTheDocument();
  });

  it('only stands in for the enrol button while the lessons wait on the provider', () => {
    expect(waitsForProvider(access({}))).toBe(true);
    expect(waitsForProvider(access({ lessonsOpen: true }))).toBe(false);
    expect(waitsForProvider(access({ requiresAdmission: false }))).toBe(false);
    expect(waitsForProvider(null)).toBe(false);
  });
});
