import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Staff keeping the disability-friendly employer list: finding the
 * organisation, listing it with what was checked, and retiring it with a
 * reason. An organisation already on the list cannot be chosen again.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

import { api } from '@/lib/api';
import { StaffDisabilityEmployers } from './StaffDisabilityEmployers';

const http = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock };

const listing = {
  id: 'dfe-1',
  organizationId: 'org-9',
  accessibilityRating: 4,
  accommodationsOffered: [],
  hasWheelchairAccess: true,
  hasFlexibleWork: false,
  hasRemoteOptions: false,
  hasMentalHealthSupport: false,
  verifiedAt: '2026-09-01T00:00:00Z',
  organization: { id: 'org-9', name: 'Coastline Council' },
};

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();
});

const respond = (listings: unknown[], hits: unknown[] = []) =>
  http.get.mockImplementation(async (url: string) => {
    if (url === '/impact/admin/disability-employers') return { data: { data: listings } };
    if (url === '/impact/admin/organizations') return { data: { data: hits } };
    throw new Error(`unexpected ${url}`);
  });

describe('StaffDisabilityEmployers', () => {
  it('finds an organisation and lists it with what was checked', async () => {
    respond(
      [],
      [
        { id: 'org-1', name: 'Harbour Health', industry: 'Health', disabilityFriendlyListings: [] },
        { id: 'org-9', name: 'Harbour Council', disabilityFriendlyListings: [{ id: 'dfe-1', verifiedAt: '2026-09-01' }] },
      ]
    );
    http.post.mockResolvedValue({ data: { message: 'Harbour Health is on the list.' } });
    render(<StaffDisabilityEmployers />);

    expect(await screen.findByText('No employer has been listed yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find the organisation'), { target: { value: 'harb' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));

    expect(await screen.findByText('Already listed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));

    fireEvent.change(screen.getByLabelText('Accessibility rating'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText('Wheelchair access'));
    fireEvent.change(screen.getByLabelText('Adjustments offered, one per line'), { target: { value: 'Screen readers\n\nQuiet room' } });
    fireEvent.change(screen.getByLabelText('What you checked'), { target: { value: 'Visited and met their HR lead' } });
    fireEvent.click(screen.getByRole('button', { name: /List this employer/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Harbour Health is on the list.');
    expect(http.post).toHaveBeenCalledWith('/impact/admin/disability-employers', {
      organizationId: 'org-1',
      accessibilityRating: 5,
      accommodationsOffered: ['Screen readers', 'Quiet room'],
      hasWheelchairAccess: true,
      hasFlexibleWork: false,
      hasRemoteOptions: false,
      hasMentalHealthSupport: false,
      basis: 'Visited and met their HR lead',
    });
  });

  it('retires a listing with a reason, and shows a refusal as the server gave it', async () => {
    respond([listing]);
    http.post.mockRejectedValueOnce({ response: { data: { message: 'reason: says in a sentence why the employer is coming off the list' } } });
    render(<StaffDisabilityEmployers />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retire' }));
    fireEvent.click(screen.getByRole('button', { name: /Retire this employer/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('says in a sentence why');

    http.post.mockResolvedValueOnce({ data: { message: 'Coastline Council is off the list.' } });
    fireEvent.change(screen.getByLabelText('Why it is coming off the list'), { target: { value: 'Their office moved and is not accessible' } });
    fireEvent.click(screen.getByRole('button', { name: /Retire this employer/ }));

    await waitFor(() =>
      expect(http.post).toHaveBeenLastCalledWith('/impact/admin/disability-employers/dfe-1/retire', { reason: 'Their office moved and is not accessible' })
    );
  });

  it('says the listings could not be loaded, rather than that there are none', async () => {
    http.get.mockRejectedValue(new Error('network'));
    render(<StaffDisabilityEmployers />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByText('No employer has been listed yet.')).not.toBeInTheDocument();
  });
});
