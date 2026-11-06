import {
  acceptMeetupProposalViaBff,
  cancelFirmShakeRequestViaBff,
  confirmMeetupDepositViaBff,
  declineMeetupProposalViaBff,
  proposeMeetupAgreementViaBff,
  startMeetupEnRouteViaBff,
} from '@/common/services/api';
import type { Agreement } from '@/types';

/** Request body for `POST /api/v1/agreements`. */
export interface ProposeMeetupAgreementInput {
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  price: number;
  meetupLat: number;
  meetupLng: number;
  meetupAddress?: string;
  meetupAt: Date;
  depositAmount: number;
}

export async function proposeMeetupAgreement(
  input: ProposeMeetupAgreementInput,
): Promise<Agreement> {
  return proposeMeetupAgreementViaBff(input);
}

export async function acceptMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  await acceptMeetupProposalViaBff(agreementId, sellerId);
}

export async function declineMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  await declineMeetupProposalViaBff(agreementId, sellerId);
}

export async function cancelFirmShakeRequest(
  agreementId: string,
  buyerId: string,
): Promise<void> {
  await cancelFirmShakeRequestViaBff(agreementId, buyerId);
}

export async function confirmMeetupDeposit(
  agreementId: string,
  buyerId: string,
): Promise<void> {
  await confirmMeetupDepositViaBff(agreementId, buyerId);
}

export async function startMeetupEnRoute(agreementId: string): Promise<void> {
  await startMeetupEnRouteViaBff(agreementId);
}
