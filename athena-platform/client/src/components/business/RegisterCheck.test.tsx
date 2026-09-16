import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterCheck } from './RegisterCheck';

jest.mock('@/lib/api', () => ({
  formationApi: { lookupAbn: jest.fn(), lookupAcn: jest.fn(), lookupName: jest.fn() },
}));

import { formationApi } from '@/lib/api';

const mocked = formationApi as unknown as { lookupAbn: jest.Mock; lookupAcn: jest.Mock; lookupName: jest.Mock };

const check = () => fireEvent.click(screen.getByRole('button', { name: /check/i }));
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('RegisterCheck', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports an ABN that passes its checksum, with who it belongs to', async () => {
    mocked.lookupAbn.mockResolvedValue({
      data: { data: { abn: '51824753556', formatted: '51 824 753 556', valid: true, configured: true, entity: { name: 'Commonwealth Scientific', status: 'Active', state: 'ACT' }, lookupUrl: 'https://abr.business.gov.au' } },
    });

    render(<RegisterCheck defaultKind="abn" />);
    type(/abn/i, '51824753556');
    check();

    expect(await screen.findByText(/51 824 753 556 passes its checksum/)).toBeInTheDocument();
    expect(screen.getByText('Commonwealth Scientific')).toBeInTheDocument();
    expect(mocked.lookupAbn).toHaveBeenCalledWith('51824753556');
  });

  it('says plainly when the checksum fails', async () => {
    mocked.lookupAbn.mockResolvedValue({ data: { data: { abn: '12345678901', valid: false, configured: true, entity: null } } });

    render(<RegisterCheck defaultKind="abn" />);
    type(/abn/i, '12345678901');
    check();

    expect(await screen.findByText(/does not pass its checksum/)).toBeInTheDocument();
    expect(screen.getByText(/An ABN is eleven, an ACN is nine/)).toBeInTheDocument();
  });

  it('distinguishes a valid number the site cannot look up from one the register does not know', async () => {
    mocked.lookupAcn.mockResolvedValue({ data: { data: { acn: '004085616', formatted: '004 085 616', valid: true, configured: false, entity: null } } });

    render(<RegisterCheck defaultKind="acn" />);
    type(/acn/i, '004085616');
    check();

    expect(await screen.findByText(/no register credential/)).toBeInTheDocument();
  });

  it('lists names already on the register, and says so when there are none', async () => {
    mocked.lookupName.mockResolvedValue({ data: { data: { configured: true, matches: [{ name: 'Bright Path Pty Ltd', abn: '11111111111', status: 'Active' }] } } });

    render(<RegisterCheck defaultKind="name" />);
    type(/business name/i, 'Bright Path');
    check();

    expect(await screen.findByText('1 name already on the register')).toBeInTheDocument();
    expect(screen.getByText('Bright Path Pty Ltd')).toBeInTheDocument();

    mocked.lookupName.mockResolvedValue({ data: { data: { configured: true, matches: [] } } });
    check();
    await waitFor(() => expect(screen.getByText(/Nothing on the register matches that name/)).toBeInTheDocument());
  });

  it('reports a register that cannot be reached rather than pretending the name is free', async () => {
    mocked.lookupName.mockRejectedValue({ response: { data: { message: 'The register is down' } } });

    render(<RegisterCheck defaultKind="name" />);
    type(/business name/i, 'Bright Path');
    check();

    expect(await screen.findByRole('alert')).toHaveTextContent('The register is down');
  });
});
