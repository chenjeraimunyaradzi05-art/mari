import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Staff listing a housing partner's places. The form sends what staff typed
 * to the admin route and shows the server's own answer; a spreadsheet is
 * checked before it is imported, and a sheet with problems lists every one
 * with its line rather than a bare failure.
 */

jest.mock('@/lib/api', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

import { api } from '@/lib/api';
import { StaffHousingSupply } from './StaffHousingSupply';

const http = api as unknown as { post: jest.Mock; get: jest.Mock };

beforeEach(() => {
  http.post.mockReset();
  http.get.mockReset();
});

describe('StaffHousingSupply', () => {
  it('sends one place with the partner account and the check note, and shows the answer', async () => {
    http.post.mockResolvedValue({ data: { message: 'Listed and live, marked as checked by ATHENA staff.' } });
    const onListed = jest.fn();
    render(<StaffHousingSupply onListed={onListed} />);

    fireEvent.change(screen.getByLabelText('Partner account email'), { target: { value: 'housing@partner.org.au' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unit in Kedron' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Secure entry' } });
    fireEvent.change(screen.getByLabelText('Features, separated by commas'), { target: { value: 'Garden, Parking' } });
    fireEvent.click(screen.getByLabelText('DV-safe'));
    fireEvent.change(screen.getByLabelText('Why this place is safe for a woman leaving violence'), { target: { value: 'Refuge-run' } });
    fireEvent.click(screen.getByLabelText(/I have checked this place/));
    fireEvent.change(screen.getByLabelText('What you checked'), { target: { value: 'Visited with the manager on Tuesday' } });
    fireEvent.click(screen.getByRole('button', { name: /List this place/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Listed and live, marked as checked');
    const [url, body] = http.post.mock.calls[0];
    expect(url).toBe('/housing/admin/listings');
    expect(body).toMatchObject({
      title: 'Unit in Kedron',
      features: ['Garden', 'Parking'],
      dvSafe: true,
      dvSafeNote: 'Refuge-run',
      safetyVerified: true,
      safetyCheckNote: 'Visited with the manager on Tuesday',
      listerEmail: 'housing@partner.org.au',
    });
    expect(onListed).toHaveBeenCalled();
  });

  it('shows the server’s refusal, not a success', async () => {
    http.post.mockRejectedValue({ response: { data: { message: 'postcode is four digits' } } });
    render(<StaffHousingSupply />);

    fireEvent.click(screen.getByRole('button', { name: /List this place/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('postcode is four digits');
  });

  it('checks a sheet before importing it, then imports it', async () => {
    http.post
      .mockResolvedValueOnce({ data: { data: { rows: 2, heldForCheck: 1, listerIsStaff: false, titles: ['A', 'B'] } } })
      .mockResolvedValueOnce({ data: { message: '2 imported; 1 held for a safety check.' } });
    render(<StaffHousingSupply />);

    fireEvent.click(screen.getByRole('tab', { name: /From a spreadsheet/ }));
    fireEvent.change(screen.getByLabelText('Or paste it'), { target: { value: 'title,description,type\nA,B,RENTAL\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check the sheet' }));

    expect(await screen.findByText('2 rows ready.')).toBeInTheDocument();
    expect(screen.getByText(/1 claims to be DV-safe/)).toBeInTheDocument();
    expect(http.post.mock.calls[0][1]).toEqual({ csv: 'title,description,type\nA,B,RENTAL\n', dryRun: true });

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 places' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 imported; 1 held for a safety check.'));
    expect(http.post.mock.calls[1][1]).toEqual({ csv: 'title,description,type\nA,B,RENTAL\n' });
  });

  it('lists every problem in a sheet with its line', async () => {
    http.post.mockRejectedValue({
      response: {
        data: {
          message: '2 problems in the sheet. Nothing was imported.',
          errors: [
            { line: 3, title: 'Unit', message: 'type is one of RENTAL, SHARE, EMERGENCY, TRANSITIONAL' },
            { line: 4, title: null, message: 'bedrooms is a whole number' },
          ],
        },
      },
    });
    render(<StaffHousingSupply />);

    fireEvent.click(screen.getByRole('tab', { name: /From a spreadsheet/ }));
    fireEvent.change(screen.getByLabelText('Or paste it'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check the sheet' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was imported');
    expect(screen.getByText(/Line 3 \(Unit\): type is one of/)).toBeInTheDocument();
    expect(screen.getByText('Line 4: bedrooms is a whole number')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import/ })).not.toBeInTheDocument();
  });
});
