import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CourseEditorPage from './page';

/**
 * The course details a provider can now set.
 *
 * The server has accepted study modes, funding options, intake dates, a
 * provider name, a graduate employment rate and a starting salary on a course
 * for some time, and the public course page and catalogue filters read them,
 * but no screen could set any of them. These are the guards on the editor
 * sending them in the shape the server validates.
 */

// The React this suite runs on predates `use`; the page only uses it to read
// its route params, so it is answered with them directly.
jest.mock('react', () => ({
  ...(jest.requireActual('react') as object),
  use: () => ({ orgId: 'org-1', courseId: 'c1' }),
}));

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

jest.mock('@/lib/api', () => ({
  courseApi: {
    builder: jest.fn(),
    update: jest.fn(),
    addModule: jest.fn(),
    updateModule: jest.fn(),
    deleteModule: jest.fn(),
    addLesson: jest.fn(),
    updateLesson: jest.fn(),
    deleteLesson: jest.fn(),
  },
}));

import toast from 'react-hot-toast';
import { courseApi } from '@/lib/api';

const api = courseApi as unknown as Record<string, jest.Mock>;

const COURSE = {
  id: 'c1',
  title: 'Bookkeeping Foundations',
  slug: 'bookkeeping-foundations',
  description: 'Get your books in order.',
  type: 'short_course',
  durationMonths: 3,
  cost: 0,
  providerName: null,
  studyMode: ['online'],
  fundingOptions: [],
  intakeDates: [],
  employmentRate: null,
  avgStartingSalary: null,
  isActive: false,
  modules: [],
  organization: { id: 'org-1', name: 'TAFE Queensland' },
  _count: { enrollments: 0, certificates: 2 },
};

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CourseEditorPage params={Promise.resolve({ orgId: 'org-1', courseId: 'c1' })} />
    </QueryClientProvider>
  );
}

describe('The course editor’s details', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.builder.mockResolvedValue({ data: { data: COURSE } });
    api.update.mockResolvedValue({ data: { data: COURSE } });
  });

  it('sends the listing details the public page reads, and leaves an unchanged title alone', async () => {
    renderEditor();
    await screen.findByText(/2 certificates have been issued/);

    fireEvent.click(screen.getByLabelText('Part-time'));
    fireEvent.change(screen.getByPlaceholderText(/VET Student Loans/), {
      target: { value: 'VET Student Loans,  Fee-free TAFE ,' },
    });
    fireEvent.change(screen.getByLabelText('New intake date'), { target: { value: '2027-02-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Add intake/ }));
    fireEvent.change(screen.getByLabelText(/Graduates in work/), { target: { value: '82' } });
    fireEvent.change(screen.getByLabelText(/Average starting salary/), { target: { value: '61000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const [, payload] = api.update.mock.calls[0];
    expect(payload).toMatchObject({
      type: 'short_course',
      studyMode: ['online', 'part-time'],
      fundingOptions: ['VET Student Loans', 'Fee-free TAFE'],
      intakeDates: ['2027-02-01T00:00:00.000Z'],
      employmentRate: 82,
      avgStartingSalary: 61000,
    });
    // Either name in the body is a rename to the server.
    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('providerName');
  });

  it('will not send an employment rate that is not a whole percentage', async () => {
    renderEditor();
    await screen.findByText(/2 certificates have been issued/);

    fireEvent.change(screen.getByLabelText(/Graduates in work/), { target: { value: '87.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/whole number from 0 to 100/)));
    expect(api.update).not.toHaveBeenCalled();
  });

  it('shows the server’s refusal in its own words', async () => {
    api.update.mockRejectedValue({ response: { status: 400, data: { message: 'each intake date must be a date' } } });
    renderEditor();
    await screen.findByText(/2 certificates have been issued/);

    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('each intake date must be a date'));
  });
});
