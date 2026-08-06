import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

import type { Agreement } from '@/types';
import { MIN_MEETUP_DEPOSIT_AMOUNT } from '@/types';
import { db } from '@/common/services/firebase';
import { createNotification } from '@/features/messages/services/notifications';

function mapAgreement(id: string, data: Record<string, unknown>): Agreement {
  const parseDate = (value: unknown): Date | undefined => {
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate();
    }
    return undefined;
  };

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
    depositAmount: Number(data.depositAmount ?? 10),
    depositPaidAt: parseDate(data.depositPaidAt),
    status: (data.status as Agreement['status']) ?? 'proposed',
    cancelledBy: data.cancelledBy ? String(data.cancelledBy) : undefined,
    buyerEtaMinutes: data.buyerEtaMinutes as number | undefined,
    buyerProgressPercent: data.buyerProgressPercent as number | undefined,
    sellerEtaMinutes: data.sellerEtaMinutes as number | undefined,
    sellerProgressPercent: data.sellerProgressPercent as number | undefined,
  };
}

async function findBuyerAgreementForListing(
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

  const agreements = snapshot.docs.map((entry) => mapAgreement(entry.id, entry.data()));
  return (
    agreements.find(
      (agreement) =>
        !['cancelled', 'completed', 'no_show_buyer', 'no_show_seller'].includes(agreement.status),
    ) ?? agreements[0]
  );
}

async function getAgreementById(agreementId: string): Promise<Agreement | null> {
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, 'agreements', agreementId));
  if (!snapshot.exists()) {
    return null;
  }

  return mapAgreement(snapshot.id, snapshot.data());
}

export async function proposeMeetupAgreementViaFirestore(input: {
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
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  if (input.depositAmount < MIN_MEETUP_DEPOSIT_AMOUNT) {
    throw new Error(`Deposit must be at least $${MIN_MEETUP_DEPOSIT_AMOUNT}`);
  }

  const existing = await findBuyerAgreementForListing(input.listingId, input.buyerId);
  if (existing && !['cancelled', 'completed', 'no_show_buyer', 'no_show_seller'].includes(existing.status)) {
    throw new Error('You already have an active FirmShake request for this listing');
  }

  const docRef = await addDoc(collection(db, 'agreements'), {
    listingId: input.listingId,
    buyerId: input.buyerId,
    buyerName: input.buyerName,
    sellerId: input.sellerId,
    price: input.price,
    meetupLat: input.meetupLat,
    meetupLng: input.meetupLng,
    meetupAddress: input.meetupAddress ?? null,
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
      title: `${input.buyerName} requested a FirmShake`,
      body: `Review the FirmShake for $${input.price} with a $${input.depositAmount} deposit.`,
      listingId: input.listingId,
    });
  } catch (error) {
    console.warn('Meetup proposal sent, but notification could not be created', error);
  }

  return agreement;
}

export async function acceptMeetupProposalViaFirestore(
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
        title: 'FirmShake accepted',
        body: `Pay the $${agreement.depositAmount} deposit to lock in your meetup.`,
        listingId: agreement.listingId,
      });
    } catch (error) {
      console.warn('Meetup accepted, but notification could not be created', error);
    }
  }
}

export async function declineMeetupProposalViaFirestore(
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

export async function cancelFirmShakeRequestViaFirestore(
  agreementId: string,
  buyerId: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const agreement = await getAgreementById(agreementId);
  if (!agreement) {
    throw new Error('FirmShake not found');
  }

  if (agreement.buyerId !== buyerId) {
    throw new Error('You can only cancel your own FirmShake request');
  }

  if (agreement.status !== 'proposed') {
    throw new Error('Only pending FirmShake requests can be cancelled');
  }

  await setDoc(
    doc(db, 'agreements', agreementId),
    {
      status: 'cancelled',
      cancelledBy: buyerId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function confirmMeetupDepositViaFirestore(
  agreementId: string,
  buyerId: string,
): Promise<void> {
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

export async function startMeetupEnRouteViaFirestore(agreementId: string): Promise<void> {
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

export async function cancelActiveAgreementOnBlockViaFirestore(
  agreement: Agreement,
  userId: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await setDoc(
    doc(db, 'agreements', agreement.id),
    {
      status: 'cancelled',
      cancelledBy: userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
