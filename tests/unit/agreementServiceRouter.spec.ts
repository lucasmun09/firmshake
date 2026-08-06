import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Agreement } from '@/types';

const useBffAgreements = vi.fn(() => false);
const proposeBff = vi.fn();
const acceptBff = vi.fn();
const declineBff = vi.fn();
const cancelBff = vi.fn();
const depositBff = vi.fn();
const enRouteBff = vi.fn();
const proposeFirestore = vi.fn();
const acceptFirestore = vi.fn();
const declineFirestore = vi.fn();
const cancelFirestore = vi.fn();
const depositFirestore = vi.fn();
const enRouteFirestore = vi.fn();

vi.mock('@/common/config/featureFlags', () => ({
  useBffAgreements: () => useBffAgreements(),
}));

vi.mock('@/common/services/agreementBff', () => ({
  proposeMeetupAgreement: (...args: unknown[]) => proposeBff(...args),
  acceptMeetupProposal: (...args: unknown[]) => acceptBff(...args),
  declineMeetupProposal: (...args: unknown[]) => declineBff(...args),
  cancelFirmShakeRequest: (...args: unknown[]) => cancelBff(...args),
  confirmMeetupDeposit: (...args: unknown[]) => depositBff(...args),
  startMeetupEnRoute: (...args: unknown[]) => enRouteBff(...args),
}));

vi.mock('@/common/services/agreementFirestoreWrites', () => ({
  proposeMeetupAgreementViaFirestore: (...args: unknown[]) => proposeFirestore(...args),
  acceptMeetupProposalViaFirestore: (...args: unknown[]) => acceptFirestore(...args),
  declineMeetupProposalViaFirestore: (...args: unknown[]) => declineFirestore(...args),
  cancelFirmShakeRequestViaFirestore: (...args: unknown[]) => cancelFirestore(...args),
  confirmMeetupDepositViaFirestore: (...args: unknown[]) => depositFirestore(...args),
  startMeetupEnRouteViaFirestore: (...args: unknown[]) => enRouteFirestore(...args),
  cancelActiveAgreementOnBlockViaFirestore: vi.fn(),
}));

const sampleAgreement: Agreement = {
  id: 'agreement-1',
  listingId: 'listing-1',
  buyerId: 'buyer-1',
  buyerName: 'Buyer Bob',
  sellerId: 'seller-1',
  price: 100,
  meetupLat: 37.77,
  meetupLng: -122.42,
  depositAmount: 10,
  status: 'proposed',
};

const proposeInput = {
  listingId: 'listing-1',
  buyerId: 'buyer-1',
  buyerName: 'Buyer Bob',
  sellerId: 'seller-1',
  price: 100,
  meetupLat: 37.77,
  meetupLng: -122.42,
  meetupAt: new Date('2026-08-10T18:00:00Z'),
  depositAmount: 10,
};

describe('agreementServiceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBffAgreements.mockReturnValue(false);
    proposeBff.mockResolvedValue(sampleAgreement);
    proposeFirestore.mockResolvedValue({ ...sampleAgreement, id: 'fs-agreement-1' });
  });

  it('routes propose to Firestore when BFF flag is off', async () => {
    const { routeProposeMeetupAgreement } = await import(
      '@/common/services/agreementServiceRouter'
    );

    const result = await routeProposeMeetupAgreement(proposeInput);

    expect(proposeFirestore).toHaveBeenCalledWith(proposeInput);
    expect(proposeBff).not.toHaveBeenCalled();
    expect(result.id).toBe('fs-agreement-1');
  });

  it('routes propose to BFF when flag is on', async () => {
    useBffAgreements.mockReturnValue(true);
    const { routeProposeMeetupAgreement } = await import(
      '@/common/services/agreementServiceRouter'
    );

    await routeProposeMeetupAgreement(proposeInput);

    expect(proposeBff).toHaveBeenCalledWith(proposeInput);
    expect(proposeFirestore).not.toHaveBeenCalled();
  });

  it('routes accept to BFF when flag is on', async () => {
    useBffAgreements.mockReturnValue(true);
    const { routeAcceptMeetupProposal } = await import(
      '@/common/services/agreementServiceRouter'
    );

    await routeAcceptMeetupProposal('agreement-1', 'seller-1');

    expect(acceptBff).toHaveBeenCalledWith('agreement-1', 'seller-1');
    expect(acceptFirestore).not.toHaveBeenCalled();
  });

  it('routes deposit to Firestore when flag is off', async () => {
    const { routeConfirmMeetupDeposit } = await import(
      '@/common/services/agreementServiceRouter'
    );

    await routeConfirmMeetupDeposit('agreement-1', 'buyer-1');

    expect(depositFirestore).toHaveBeenCalledWith('agreement-1', 'buyer-1');
    expect(depositBff).not.toHaveBeenCalled();
  });

  it('routes en-route to BFF when flag is on', async () => {
    useBffAgreements.mockReturnValue(true);
    const { routeStartMeetupEnRoute } = await import(
      '@/common/services/agreementServiceRouter'
    );

    await routeStartMeetupEnRoute('agreement-1');

    expect(enRouteBff).toHaveBeenCalledWith('agreement-1');
    expect(enRouteFirestore).not.toHaveBeenCalled();
  });

  it('shouldRouteAgreementsViaBff reflects flag', async () => {
    useBffAgreements.mockReturnValue(true);
    const { shouldRouteAgreementsViaBff } = await import(
      '@/common/services/agreementServiceRouter'
    );
    expect(shouldRouteAgreementsViaBff()).toBe(true);
  });
});
