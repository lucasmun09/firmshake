import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Agreement, AgreementStatus } from '@/types';
import { MEETUP_DEPOSIT_AMOUNT } from '@/types';
import { db } from '@/common/services/firebase';
import {
  routeAcceptMeetupProposal,
  routeCancelActiveAgreementOnBlock,
  routeCancelFirmShakeRequest,
  routeConfirmMeetupDeposit,
  routeDeclineMeetupProposal,
  routeProposeMeetupAgreement,
  routeStartMeetupEnRoute,
} from '@/common/services/agreementServiceRouter';

export type { ProposeMeetupAgreementInput } from '@/common/services/agreementServiceRouter';

function parseDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }

  return undefined;
}

function mapAgreement(id: string, data: Record<string, unknown>): Agreement {
  return {
    id,
    listingId: String(data.listingId ?? ''),
    buyerId: String(data.buyerId ?? ''),
    buyerName: String(data.buyerName ?? 'Buyer'),
    sellerId: String(data.sellerId ?? ''),
    price: Number(data.price ?? 0),
    meetupLat: Number(data.meetupLat ?? 0),
    meetupLng: Number(data.meetupLng ?? 0),
    meetupAddress: data.meetupAddress ? String(data.meetupAddress) : undefined,
    meetupAt: parseDate(data.meetupAt),
    depositAmount: Number(data.depositAmount ?? MEETUP_DEPOSIT_AMOUNT),
    depositPaidAt: parseDate(data.depositPaidAt),
    status: (data.status as AgreementStatus) ?? 'proposed',
    cancelledBy: data.cancelledBy ? String(data.cancelledBy) : undefined,
    buyerEtaMinutes: data.buyerEtaMinutes as number | undefined,
    buyerProgressPercent: data.buyerProgressPercent as number | undefined,
    sellerEtaMinutes: data.sellerEtaMinutes as number | undefined,
    sellerProgressPercent: data.sellerProgressPercent as number | undefined,
  };
}

function sortAgreements(agreements: Agreement[]): Agreement[] {
  return [...agreements].sort((left, right) => {
    const leftTime = left.meetupAt?.getTime() ?? 0;
    const rightTime = right.meetupAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

export async function proposeMeetupAgreement(input: {
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
}): Promise<Agreement> {
  return routeProposeMeetupAgreement(input);
}

export async function acceptMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  await routeAcceptMeetupProposal(agreementId, sellerId);
}

export async function declineMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  await routeDeclineMeetupProposal(agreementId, sellerId);
}

export async function cancelFirmShakeRequest(
  agreementId: string,
  buyerId: string,
): Promise<void> {
  await routeCancelFirmShakeRequest(agreementId, buyerId);
}

export async function confirmMeetupDeposit(agreementId: string, buyerId: string): Promise<void> {
  await routeConfirmMeetupDeposit(agreementId, buyerId);
}

export async function startMeetupEnRoute(agreementId: string): Promise<void> {
  await routeStartMeetupEnRoute(agreementId);
}

export async function getAgreementById(agreementId: string): Promise<Agreement | null> {
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, 'agreements', agreementId));
  if (!snapshot.exists()) {
    return null;
  }

  return mapAgreement(snapshot.id, snapshot.data());
}

export async function findBuyerAgreementForListing(
  listingId: string,
  buyerId: string,
): Promise<Agreement | null> {
  if (!db) {
    return null;
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'agreements'),
      where('listingId', '==', listingId),
      where('buyerId', '==', buyerId),
    ),
  );

  if (snapshot.empty) {
    return null;
  }

  const agreements = sortAgreements(
    snapshot.docs.map((entry) => mapAgreement(entry.id, entry.data())),
  );

  return (
    agreements.find(
      (agreement) =>
        !['cancelled', 'completed', 'no_show_buyer', 'no_show_seller'].includes(agreement.status),
    ) ?? agreements[0]
  );
}

export async function findAgreementForListing(
  listingId: string,
  userId: string,
): Promise<Agreement | null> {
  const buyerAgreement = await findBuyerAgreementForListing(listingId, userId);
  if (buyerAgreement) {
    return buyerAgreement;
  }

  const sellerAgreements = await findSellerAgreementsForListing(listingId, userId);
  return sellerAgreements[0] ?? null;
}

export async function findSellerAgreementsForListing(
  listingId: string,
  sellerId: string,
): Promise<Agreement[]> {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'agreements'),
      where('listingId', '==', listingId),
      where('sellerId', '==', sellerId),
    ),
  );

  return sortAgreements(
    snapshot.docs
      .map((entry) => mapAgreement(entry.id, entry.data()))
      .filter(
        (agreement) =>
          !['cancelled', 'completed', 'no_show_buyer', 'no_show_seller'].includes(agreement.status),
      ),
  );
}

export function subscribeAgreement(
  agreementId: string,
  onData: (agreement: Agreement | null) => void,
): Unsubscribe {
  if (!db) {
    onData(null);
    return () => undefined;
  }

  return onSnapshot(doc(db, 'agreements', agreementId), (snapshot) => {
    if (!snapshot.exists()) {
      onData(null);
      return;
    }
    onData(mapAgreement(snapshot.id, snapshot.data()));
  });
}

export function subscribeListingAgreements(
  listingId: string,
  userId: string,
  onData: (agreements: Agreement[]) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const agreementsQuery = query(
    collection(db, 'agreements'),
    where('listingId', '==', listingId),
    where('sellerId', '==', userId),
  );

  return onSnapshot(agreementsQuery, (snapshot) => {
    onData(
      sortAgreements(
        snapshot.docs
          .map((entry) => mapAgreement(entry.id, entry.data()))
          .filter(
            (agreement) =>
              !['cancelled', 'completed', 'no_show_buyer', 'no_show_seller'].includes(
                agreement.status,
              ),
          ),
      ),
    );
  });
}

export function getAgreementStatusLabel(status: AgreementStatus): string {
  switch (status) {
    case 'proposed':
      return 'Awaiting seller';
    case 'accepted':
      return 'Deposit due';
    case 'deposit_paid':
      return 'Ready to meet';
    case 'en_route':
      return 'En route';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'no_show_buyer':
      return 'Buyer no-show';
    case 'no_show_seller':
      return 'Seller no-show';
    default:
      return status;
  }
}

const ACTIVE_AGREEMENT_STATUSES: AgreementStatus[] = [
  'proposed',
  'accepted',
  'deposit_paid',
  'en_route',
];

function isActiveAgreement(agreement: Agreement): boolean {
  return ACTIVE_AGREEMENT_STATUSES.includes(agreement.status);
}

export { isActiveAgreement };

export type BlockCancelAction =
  | 'buyer-cancel-proposed'
  | 'seller-decline-proposed'
  | 'direct-cancel';

/** Which cancel path applies when the blockee must end an active FirmShake after being blocked. */
export function getBlockCancelAction(
  agreement: Agreement,
  userId: string,
): BlockCancelAction | null {
  if (!isActiveAgreement(agreement)) {
    return null;
  }

  if (agreement.status === 'proposed') {
    if (userId === agreement.buyerId) {
      return 'buyer-cancel-proposed';
    }
    if (userId === agreement.sellerId) {
      return 'seller-decline-proposed';
    }
    return null;
  }

  if (userId === agreement.buyerId || userId === agreement.sellerId) {
    return 'direct-cancel';
  }

  return null;
}

/** Cancel an active FirmShake when the current user was blocked by the other party. */
export async function cancelActiveAgreementOnBlock(
  agreement: Agreement,
  userId: string,
): Promise<void> {
  const action = getBlockCancelAction(agreement, userId);
  if (!action) {
    return;
  }

  await routeCancelActiveAgreementOnBlock(agreement, userId, action);
}

export function getBuyerFirmShakeLabel(agreement: Agreement | null | undefined): string | null {
  const state = getBuyerListingFirmShakeState(agreement ? [agreement] : []);
  return state.label;
}

export type FirmShakeListingKind = 'accepted' | 'requested' | 'none' | 'declined';

export interface FirmShakeListingState {
  kind: FirmShakeListingKind;
  agreement: Agreement | null;
  proposedAgreements: Agreement[];
  label: string | null;
}

export function getProposedAgreements(agreements: Agreement[]): Agreement[] {
  return sortAgreements(
    agreements.filter(
      (agreement) => agreement.status === 'proposed',
    ),
  );
}

/** Unique buyers who messaged or sent a pending FirmShake for a listing. */
export function countListingBuyerOutreach(
  listingId: string,
  threads: { listingId: string; buyerId?: string }[],
  agreements: Agreement[],
): number {
  const buyerIds = new Set<string>();

  for (const thread of threads) {
    if (thread.listingId === listingId && thread.buyerId) {
      buyerIds.add(thread.buyerId);
    }
  }

  for (const agreement of getProposedAgreements(agreements)) {
    if (agreement.listingId === listingId) {
      buyerIds.add(agreement.buyerId);
    }
  }

  return buyerIds.size;
}

export function findAgreementForBuyer(
  agreements: Agreement[],
  buyerId: string,
): Agreement | null {
  const buyerAgreements = sortAgreements(
    agreements.filter((agreement) => agreement.buyerId === buyerId),
  );

  const active = buyerAgreements.find((agreement) => isActiveAgreement(agreement));
  if (active) {
    return active;
  }

  return buyerAgreements[0] ?? null;
}

export function getSellerFirmShakeListLink(listingId: string, agreements: Agreement[]): string | null {
  const viewable = agreements.filter(
    (agreement) =>
      isActiveAgreement(agreement) ||
      (agreement.status === 'cancelled' &&
        (!agreement.cancelledBy || agreement.cancelledBy === agreement.sellerId)),
  );

  if (viewable.length > 1 || getProposedAgreements(agreements).length > 1) {
    return `/tabs/selling/listing/${listingId}/firmshakes`;
  }

  return null;
}

function mostRecentViewableAgreement(agreements: Agreement[]): Agreement | null {
  if (agreements.length === 0) {
    return null;
  }

  const active = agreements.filter(isActiveAgreement);
  if (active.length > 0) {
    return sortAgreements(active)[0] ?? null;
  }

  return sortAgreements(agreements)[0] ?? null;
}

export function getViewableAgreementForListing(
  agreements: Agreement[],
): Agreement | null {
  return mostRecentViewableAgreement(agreements);
}

export function getBuyerListingFirmShakeState(agreements: Agreement[]): FirmShakeListingState {
  const active = agreements.filter(isActiveAgreement);
  const proposed = active.find((agreement) => agreement.status === 'proposed');
  if (proposed) {
    return {
      kind: 'requested',
      agreement: proposed,
      proposedAgreements: getProposedAgreements(agreements),
      label: 'FirmShake Requested',
    };
  }

  const accepted = active.find((agreement) =>
    ['accepted', 'deposit_paid', 'en_route'].includes(agreement.status),
  );
  if (accepted) {
    return {
      kind: 'accepted',
      agreement: accepted,
      proposedAgreements: [],
      label: 'FirmShake Accepted',
    };
  }

  return {
    kind: 'none',
    agreement: null,
    proposedAgreements: [],
    label: null,
  };
}

function sellerDeclinedAgreement(agreements: Agreement[]): Agreement | null {
  const cancelled = agreements.filter((agreement) => agreement.status === 'cancelled');
  for (const agreement of sortAgreements(cancelled)) {
    if (!agreement.cancelledBy || agreement.cancelledBy === agreement.sellerId) {
      return agreement;
    }
  }

  return null;
}

export function getSellerListingFirmShakeState(agreements: Agreement[]): FirmShakeListingState {
  const active = agreements.filter(isActiveAgreement);
  const accepted = active.find((agreement) =>
    ['accepted', 'deposit_paid', 'en_route'].includes(agreement.status),
  );
  if (accepted) {
    return {
      kind: 'accepted',
      agreement: accepted,
      proposedAgreements: getProposedAgreements(agreements),
      label: 'FirmShake Accepted',
    };
  }

  const proposedList = getProposedAgreements(agreements);
  if (proposedList.length > 0) {
    return {
      kind: 'requested',
      agreement: proposedList[0] ?? null,
      proposedAgreements: proposedList,
      label:
        proposedList.length === 1
          ? `FirmShake Received from ${proposedList[0].buyerName}`
          : `${proposedList.length} FirmShakes received`,
    };
  }

  const declined = sellerDeclinedAgreement(agreements);
  if (declined) {
    return {
      kind: 'declined',
      agreement: declined,
      proposedAgreements: [],
      label: 'FirmShake Declined',
    };
  }

  return {
    kind: 'none',
    agreement: null,
    proposedAgreements: [],
    label: null,
  };
}

export function getSellerListingSortPriority(kind: FirmShakeListingKind): number {
  switch (kind) {
    case 'accepted':
      return 0;
    case 'requested':
      return 1;
    case 'none':
      return 2;
    case 'declined':
      return 3;
    default:
      return 2;
  }
}

export function getSellerFirmShakeLabel(agreements: Agreement[]): string | null {
  return getSellerListingFirmShakeState(agreements).label;
}

export function subscribeBuyerAgreements(
  buyerId: string,
  onData: (agreements: Agreement[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const agreementsQuery = query(collection(db, 'agreements'), where('buyerId', '==', buyerId));

  return onSnapshot(
    agreementsQuery,
    (snapshot) => {
      onData(
        sortAgreements(snapshot.docs.map((entry) => mapAgreement(entry.id, entry.data()))),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeSellerAgreements(
  sellerId: string,
  onData: (agreements: Agreement[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const agreementsQuery = query(collection(db, 'agreements'), where('sellerId', '==', sellerId));

  return onSnapshot(
    agreementsQuery,
    (snapshot) => {
      onData(
        sortAgreements(snapshot.docs.map((entry) => mapAgreement(entry.id, entry.data()))),
      );
    },
    (error) => onError?.(error),
  );
}

export function groupAgreementsByListing(agreements: Agreement[]): Map<string, Agreement[]> {
  const grouped = new Map<string, Agreement[]>();

  for (const agreement of agreements) {
    const existing = grouped.get(agreement.listingId) ?? [];
    existing.push(agreement);
    grouped.set(agreement.listingId, existing);
  }

  return grouped;
}

export function formatMeetupTime(meetupAt?: Date): string {
  if (!meetupAt) {
    return 'Time not set';
  }

  return meetupAt.toLocaleString();
}

export function getOtherPartyEta(
  agreement: Agreement,
  currentUserId: string,
): { etaMinutes?: number; progressPercent?: number } {
  if (currentUserId === agreement.buyerId) {
    return {
      etaMinutes: agreement.sellerEtaMinutes,
      progressPercent: agreement.sellerProgressPercent,
    };
  }

  return {
    etaMinutes: agreement.buyerEtaMinutes,
    progressPercent: agreement.buyerProgressPercent,
  };
}

export function getMyEta(
  agreement: Agreement,
  currentUserId: string,
): { etaMinutes?: number; progressPercent?: number } {
  if (currentUserId === agreement.buyerId) {
    return {
      etaMinutes: agreement.buyerEtaMinutes,
      progressPercent: agreement.buyerProgressPercent,
    };
  }

  return {
    etaMinutes: agreement.sellerEtaMinutes,
    progressPercent: agreement.sellerProgressPercent,
  };
}
