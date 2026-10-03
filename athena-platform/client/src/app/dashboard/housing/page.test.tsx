import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The housing page, for what it says about checks and what it lets a member do
 * about a listing that is not what it says.
 *
 * "Checked by ATHENA staff" is a promise to a woman in a hard moment, so what the
 * page says it means has to be what is actually checked: a member of staff looked
 * and wrote down what they checked, and the person offering the place has a
 * provider check. It does not say police or background checks were run, because
 * none are. And every listing can be reported to the member who listed it.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
// What the address says when the page opens; a test sets it before it renders.
let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => mockSearchParams }));
jest.mock('@/lib/hooks', () => ({ useAuthStore: () => ({ user: { id: 'me', role: 'USER' } }) }));
jest.mock('@/lib/api', () => ({
  housingApi: {
    getListings: jest.fn(),
    getMyInquiries: jest.fn(),
    getMyListings: jest.fn(),
    inquireAboutListing: jest.fn(),
    removeInquiry: jest.fn(),
  },
}));
jest.mock('../safety/QuickExit', () => ({ QuickExitButton: () => null }));
jest.mock('./StaffHousingSupply', () => ({ StaffHousingSupply: () => null }));
jest.mock('./ProviderCheckPanel', () => ({ ProviderCheckPanel: () => <div>provider check panel</div> }));

const reportDialog = jest.fn();
jest.mock('@/components/safety/ReportDialog', () => ({
  ReportDialog: (props: { open: boolean; targetType: string; targetId: string; targetLabel?: string; onClose: () => void }) => {
    reportDialog(props);
    return (
      <div role="dialog" aria-label="report dialog">
        {props.targetType}:{props.targetId}
        <button type="button" onClick={props.onClose}>close report</button>
      </div>
    );
  },
}));

import { housingApi } from '@/lib/api';
import HousingPage from './page';

const api = housingApi as unknown as {
  getListings: jest.Mock;
  getMyInquiries: jest.Mock;
  getMyListings: jest.Mock;
  removeInquiry: jest.Mock;
};

const listing = (over: Record<string, unknown> = {}) => ({
  id: 'l-1',
  title: 'Sunny room in Paddington',
  description: 'A room.',
  type: 'RENTAL',
  suburb: 'Paddington',
  city: 'Brisbane',
  state: 'QLD',
  rentWeekly: 300,
  bedrooms: 1,
  bathrooms: 1,
  features: [],
  status: 'ACTIVE',
  safetyVerified: false,
  dvSafe: false,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  api.getMyInquiries.mockResolvedValue({ data: { data: [] } });
  api.getMyListings.mockResolvedValue({ data: { data: [] } });
});

describe('What the housing page says a check is', () => {
  it('says a confidential place was looked at by staff and its lister checked as a provider, and that no police check was run', async () => {
    api.getListings.mockResolvedValue({
      data: { data: [listing({ id: 'l-2', title: 'Quiet unit', dvSafe: true, safetyVerified: true })], confidential: { hidden: false, reason: null } },
    });
    render(<HousingPage />);

    const badge = await screen.findByText('Checked by ATHENA staff');
    expect(badge.closest('span')).toHaveAttribute('title', expect.stringContaining('the person offering it has been checked as a provider'));
    expect(badge.closest('span')?.getAttribute('title')).toContain('does not run police or background checks');
    expect(screen.getByText(/means a member of staff looked at it and wrote down what they checked/)).toBeInTheDocument();
  });

  it('does not claim a provider check for a listing that is not confidential', async () => {
    api.getListings.mockResolvedValue({ data: { data: [listing({ safetyVerified: true })], confidential: { hidden: false, reason: null } } });
    render(<HousingPage />);

    const badge = await screen.findByText('Checked by ATHENA staff');
    expect(badge.closest('span')?.getAttribute('title')).toBe('A member of ATHENA staff looked at this listing and wrote down what they checked.');
  });

  it('mentions emergency and transitional places where it says staff check before they show', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    render(<HousingPage />);
    expect(await screen.findByText(/DV-safe, emergency and transitional listings are checked by ATHENA staff before they show/)).toBeInTheDocument();
  });
});

describe('Reporting a listing', () => {
  it('opens the shared report dialog for that listing, as a housing listing, and closes it again', async () => {
    api.getListings.mockResolvedValue({
      data: { data: [listing(), listing({ id: 'l-3', title: 'Second place' })], confidential: { hidden: false, reason: null } },
    });
    render(<HousingPage />);

    const buttons = await screen.findAllByRole('button', { name: /Report this listing/ });
    expect(buttons).toHaveLength(2);
    expect(screen.queryByRole('dialog', { name: 'report dialog' })).not.toBeInTheDocument();

    fireEvent.click(buttons[1]);
    expect(await screen.findByRole('dialog', { name: 'report dialog' })).toHaveTextContent('housing_listing:l-3');
    expect(reportDialog).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, targetLabel: '"Second place"' }));

    fireEvent.click(screen.getByRole('button', { name: 'close report' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'report dialog' })).not.toBeInTheDocument());
  });

  it('does not offer a member a report button on their own listing', async () => {
    api.getListings.mockResolvedValue({ data: { data: [listing()], confidential: { hidden: false, reason: null } } });
    api.getMyListings.mockResolvedValue({ data: { data: [{ ...listing(), inquiries: [] }] } });
    render(<HousingPage />);

    expect(await screen.findByText('Your listing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Report this listing/ })).not.toBeInTheDocument();
  });
});

describe('Your provider check', () => {
  it('sits with the member’s own listings, where it matters', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    render(<HousingPage />);
    expect(await screen.findByText('provider check panel')).toBeInTheDocument();
  });
});

describe('A listing staff took down', () => {
  it('says so, offers no status switch that the server would refuse, and points to the appeal', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    api.getMyListings.mockResolvedValue({
      data: { data: [{ ...listing({ id: 'l-down', title: 'Room in Toowong', status: 'WITHDRAWN' }), takenDownByStaff: true, inquiries: [] }] },
    });
    render(<HousingPage />);

    expect(await screen.findByText('Taken down by ATHENA staff')).toBeInTheDocument();
    expect(screen.getByText(/cannot be put back on the list from here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'appeal the decision' })).toHaveAttribute('href', '/help/appeal');
    expect(screen.queryByLabelText('Status for Room in Toowong')).not.toBeInTheDocument();
  });

  it('still gives a listing its lister withdrew the status switch', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    api.getMyListings.mockResolvedValue({ data: { data: [{ ...listing({ id: 'l-own', title: 'Room in Toowong', status: 'WITHDRAWN' }), takenDownByStaff: false, inquiries: [] }] } });
    render(<HousingPage />);

    expect(await screen.findByLabelText('Status for Room in Toowong')).toBeInTheDocument();
    expect(screen.queryByText('Taken down by ATHENA staff')).not.toBeInTheDocument();
  });
});

/**
 * Taking an inquiry back. Withdrawing only closed it: what she asked, and every
 * line of the thread, stayed on this list for as long as the account did, which on
 * a computer someone else uses is a record that she was looking for a safe place.
 */
describe('Removing an inquiry', () => {
  const inquiry = (over: Record<string, unknown> = {}) => ({
    id: 'inq-1',
    listingId: 'l-1',
    status: 'WITHDRAWN',
    createdAt: '2026-09-20T00:00:00.000Z',
    listing: listing(),
    confidential: false,
    contactShared: false,
    thread: [],
    ...over,
  });

  it('offers to remove it whatever state it is in, withdrawn included, and says nobody is told', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    api.getMyInquiries.mockResolvedValue({ data: { data: [inquiry(), inquiry({ id: 'inq-2', status: 'PENDING' })] } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HousingPage />);

    const buttons = await screen.findAllByRole('button', { name: 'Remove this inquiry from my list' });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('The lister will not be told'));
    confirm.mockRestore();
  });

  it('removes nothing when she changes her mind at the question', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    api.getMyInquiries.mockResolvedValue({ data: { data: [inquiry()] } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<HousingPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove this inquiry from my list' }));

    expect(api.removeInquiry).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('removes it, and reads the list again so it is gone from the page', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    api.getMyInquiries.mockResolvedValueOnce({ data: { data: [inquiry()] } }).mockResolvedValue({ data: { data: [] } });
    api.removeInquiry.mockResolvedValue({ data: { success: true } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<HousingPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove this inquiry from my list' }));

    await waitFor(() => expect(api.removeInquiry).toHaveBeenCalledWith('inq-1'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove this inquiry from my list' })).not.toBeInTheDocument());
    expect(screen.getByText('No inquiries yet.')).toBeInTheDocument();
    confirm.mockRestore();
  });
});

/**
 * Saying "I have applied" is one of the states that releases the address, so
 * the server allows it only once the lister has been in touch. The page offers
 * it then and not before, rather than offering a button the server refuses.
 */
describe('Saying the member has applied', () => {
  const inquiry = (status: string, id = `inq-${status.toLowerCase()}`) => ({
    id,
    listingId: 'l-1',
    status,
    createdAt: '2026-09-20T00:00:00.000Z',
    listing: listing(),
    confidential: false,
    contactShared: false,
    thread: [],
  });

  it('is offered once the lister has been in touch, and not while the inquiry is pending', async () => {
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    api.getMyInquiries.mockResolvedValue({ data: { data: [inquiry('PENDING'), inquiry('CONTACTED'), inquiry('VIEWING_SCHEDULED'), inquiry('APPLICATION_SUBMITTED')] } });
    render(<HousingPage />);

    // Four open inquiries, each with a Withdraw; two of them answered by the lister.
    expect(await screen.findAllByRole('button', { name: 'Withdraw' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'I have applied' })).toHaveLength(2);
  });
});

describe('Arriving from the safety page', () => {
  it('keeps the DV-safe filter on and takes the word off the address, so it is not left in the history', async () => {
    mockSearchParams = new URLSearchParams('dvSafe=true');
    window.history.pushState({}, '', '/dashboard/housing?dvSafe=true#top');
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    render(<HousingPage />);

    await waitFor(() => expect(api.getListings).toHaveBeenCalledWith(expect.objectContaining({ dvSafe: true })));
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/dashboard/housing');
    expect(window.location.hash).toBe('#top');
  });

  it('leaves an address with no such word alone', async () => {
    window.history.pushState({}, '', '/dashboard/housing?type=RENTAL');
    api.getListings.mockResolvedValue({ data: { data: [], confidential: { hidden: false, reason: null } } });
    render(<HousingPage />);

    await waitFor(() => expect(api.getListings).toHaveBeenCalled());
    expect(window.location.search).toBe('?type=RENTAL');
  });
});
