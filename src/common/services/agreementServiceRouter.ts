/**
 * Routes FirmShake agreement mutations to Firestore or firmshake-api based on feature flags.
 */
import { useBffAgreements } from '@/common/config/featureFlags';
import type { Agreement } from '@/types';

import * as agreementBff from './agreementBff';
import * as agreementFirestoreWrites from './agreementFirestoreWrites';

export type { ProposeMeetupAgreementInput } from './agreementBff';

export function shouldRouteAgreementsViaBff(): boolean {
  return useBffAgreements();
}

export async function routeProposeMeetupAgreement(
  input: agreementBff.ProposeMeetupAgreementInput,
): Promise<Agreement> {
  if (useBffAgreements()) {
    return agreementBff.proposeMeetupAgreement(input);
  }
  return agreementFirestoreWrites.proposeMeetupAgreementViaFirestore(input);
}

export async function routeAcceptMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  if (useBffAgreements()) {
    await agreementBff.acceptMeetupProposal(agreementId, sellerId);
    return;
  }
  await agreementFirestoreWrites.acceptMeetupProposalViaFirestore(agreementId, sellerId);
}

export async function routeDeclineMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  if (useBffAgreements()) {
    await agreementBff.declineMeetupProposal(agreementId, sellerId);
    return;
  }
  await agreementFirestoreWrites.declineMeetupProposalViaFirestore(agreementId, sellerId);
}

export async function routeCancelFirmShakeRequest(
  agreementId: string,
  buyerId: string,
): Promise<void> {
  if (useBffAgreements()) {
    await agreementBff.cancelFirmShakeRequest(agreementId, buyerId);
    return;
  }
  await agreementFirestoreWrites.cancelFirmShakeRequestViaFirestore(agreementId, buyerId);
}

export async function routeConfirmMeetupDeposit(
  agreementId: string,
  buyerId: string,
): Promise<void> {
  if (useBffAgreements()) {
    await agreementBff.confirmMeetupDeposit(agreementId, buyerId);
    return;
  }
  await agreementFirestoreWrites.confirmMeetupDepositViaFirestore(agreementId, buyerId);
}

export async function routeStartMeetupEnRoute(agreementId: string): Promise<void> {
  if (useBffAgreements()) {
    await agreementBff.startMeetupEnRoute(agreementId);
    return;
  }
  await agreementFirestoreWrites.startMeetupEnRouteViaFirestore(agreementId);
}

export async function routeCancelActiveAgreementOnBlock(
  agreement: Agreement,
  userId: string,
  action: 'buyer-cancel-proposed' | 'seller-decline-proposed' | 'direct-cancel',
): Promise<void> {
  if (action === 'buyer-cancel-proposed') {
    await routeCancelFirmShakeRequest(agreement.id, userId);
    return;
  }

  if (action === 'seller-decline-proposed') {
    await routeDeclineMeetupProposal(agreement.id, userId);
    return;
  }

  if (useBffAgreements()) {
    const { cancelActiveAgreementViaBff } = await import('@/common/services/api');
    await cancelActiveAgreementViaBff(agreement.id);
    return;
  }

  await agreementFirestoreWrites.cancelActiveAgreementOnBlockViaFirestore(agreement, userId);
}
