/**
 * An invitation nobody has answered is an OrganizationMember row with no
 * acceptedAt, and it used to open the organisation's ledger, BAS worksheet
 * and stock lists. Both scope checks now ask for an accepted membership.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const findFirst = jest.fn() as jest.Mock<(args: any) => Promise<unknown>>;
const findMany = jest.fn() as jest.Mock<(args: any) => Promise<unknown>>;
jest.mock('../prisma', () => ({
  prisma: { organizationMember: { findFirst, findMany } },
}));

import { assertOrgMembership, memberOrganizationIds } from '../org-scope';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('organisation scope', () => {
  it('asks for an accepted membership, and refuses when there is none', async () => {
    findFirst.mockResolvedValue(null);

    await expect(assertOrgMembership('org-1', 'invitee')).rejects.toMatchObject({ statusCode: 403 });
    expect(findFirst.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      userId: 'invitee',
      acceptedAt: { not: null },
    });
  });

  it('lets an accepted member through', async () => {
    findFirst.mockResolvedValue({ id: 'm-1' });
    await expect(assertOrgMembership('org-1', 'member')).resolves.toBeUndefined();
  });

  it('lists only the organisations she has accepted', async () => {
    findMany.mockResolvedValue([{ organizationId: 'org-1' }]);

    await expect(memberOrganizationIds('member')).resolves.toEqual(['org-1']);
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: 'member', acceptedAt: { not: null } });
  });
});
