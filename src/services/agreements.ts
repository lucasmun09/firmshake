import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Agreement, AgreementStatus } from '@/types';
import { MEETUP_DEPOSIT_AMOUNT, MIN_MEETUP_DEPOSIT_AMOUNT } from '@/types';
import { db } from './firebase';
import { createNotification } from './notifications';

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
    meetupAt: parseDate(data.meetupAt),
    depositAmount: Number(data.depositAmount ?? MEETUP_DEPOSIT_AMOUNT),
    depositPaidAt: parseDate(data.depositPaidAt),
    status: (data.status as AgreementStatus) ?? 'proposed',
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
  meetupAt: Date;
  depositAmount: number;
}): Promise<Agreement> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  if (input.depositAmount < MIN_MEETUP_DEPOSIT_AMOUNT) {
    throw new Error(`Deposit must be at least $${MIN_MEETUP_DEPOSIT_AMOUNT}`);
  }

  const existing = await findBuyerAgreementForListing(input.listingId, input.buyerId);
  if (existing && !['cancelled', 'completed', 'no_show_buyer', 'no_show_seller'].includes(existing.status)) {
    throw new Error('You already have an active meetup request for this listing');
  }

  const docRef = await addDoc(collection(db, 'agreements'), {
    listingId: input.listingId,
    buyerId: input.buyerId,
    buyerName: input.buyerName,
    sellerId: input.sellerId,
    price: input.price,
    meetupLat: input.meetupLat,
    meetupLng: input.meetupLng,
    meetupAt: Timestamp.fromDate(input.meetupAt),
    depositAmount: input.depositAmount,
    status: 'proposed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const agreement: Agreement = {
    id: docRef.id,
    ...input,
    status: 'proposed',
  };

  try {
    await createNotification({
      recipientId: input.sellerId,
      actorId: input.buyerId,
      type: 'meetup',
      title: `${input.buyerName} requested a binding meetup`,
      body: `Review the meetup request for $${input.price} with a $${input.depositAmount} deposit.`,
      listingId: input.listingId,
    });
  } catch (error) {
    console.warn('Meetup proposal sent, but notification could not be created', error);
  }

  return agreement;
}

export async function acceptMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await setDoc(
    doc(db, 'agreements', agreementId),
    {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const agreement = await getAgreementById(agreementId);
  if (agreement) {
    try {
      await createNotification({
        recipientId: agreement.buyerId,
        actorId: sellerId,
        type: 'meetup',
        title: 'Meetup request accepted',
        body: `Pay the $${agreement.depositAmount} deposit to lock in your meetup.`,
        listingId: agreement.listingId,
      });
    } catch (error) {
      console.warn('Meetup accepted, but notification could not be created', error);
    }
  }
}

export async function declineMeetupProposal(
  agreementId: string,
  sellerId: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await setDoc(
    doc(db, 'agreements', agreementId),
    {
      status: 'cancelled',
      cancelledBy: sellerId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function confirmMeetupDeposit(agreementId: string, buyerId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await setDoc(
    doc(db, 'agreements', agreementId),
    {
      status: 'deposit_paid',
      depositPaidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const agreement = await getAgreementById(agreementId);
  if (agreement) {
    try {
      await createNotification({
        recipientId: agreement.sellerId,
        actorId: buyerId,
        type: 'meetup',
        title: 'Deposit received',
        body: `${agreement.buyerName} paid the meetup deposit. You can head to the meetup when ready.`,
        listingId: agreement.listingId,
      });
    } catch (error) {
      console.warn('Deposit confirmed, but notification could not be created', error);
    }
  }
}

export async function startMeetupEnRoute(agreementId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await setDoc(
    doc(db, 'agreements', agreementId),
    {
      status: 'en_route',
      enRouteAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
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
