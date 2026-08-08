import { debugLog } from '@/common/debug/debugLog';
import { loggedFetch } from '@/common/debug/loggedFetch';
import { getDedupedIdToken } from '@/common/services/firestoreAuth';
import { getApiBaseUrl, getApiUnavailableMessage, isApiConfigured } from '@/utils/apiBaseUrl';
import { currentUser } from '@/features/auth/services/auth';
import type { Agreement, Listing, Message, NotificationType } from '@/types';

export async function authHeaders(forceRefresh = false): Promise<HeadersInit> {
  const headers: HeadersInit = {};
  const user = currentUser.value;
  if (user) {
    const token = await getDedupedIdToken(user, forceRefresh);
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function parseApiError(body: string, fallback: string): string {
  try {
    const data = JSON.parse(body) as { error?: string };
    if (data.error) {
      return data.error;
    }
  } catch {
    // Use raw body below.
  }

  return body.trim() || fallback;
}

const API_HEALTH_ATTEMPT_TIMEOUT_MS = 8_000;
/** Pause between retries — helps Cloud Run cold starts without blocking UI forever. */
const API_HEALTH_RETRY_DELAYS_MS = [0, 2_000, 4_000];

async function probeApiHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_ATTEMPT_TIMEOUT_MS);

  try {
    const response = await loggedFetch(
      `${getApiBaseUrl()}/health`,
      { signal: controller.signal },
      {
        category: 'api',
        label: 'GET /health',
      },
    );
    return response.ok;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkApiHealth(): Promise<boolean> {
  if (!isApiConfigured()) {
    return false;
  }

  for (let attempt = 0; attempt < API_HEALTH_RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = API_HEALTH_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      if (await probeApiHealth()) {
        return true;
      }
    } catch {
      // Retry on network errors, timeouts, and aborts (e.g. cold start).
    }
  }

  return false;
}

export async function uploadImage(file: File, communityIds: string[]): Promise<string> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('communityIds', JSON.stringify(communityIds));

  debugLog.info('listing', 'Uploading image', {
    fileName: file.name,
    size: file.size,
    communityIds,
  });

  const response = await loggedFetch(`${getApiBaseUrl()}/api/images`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: formData,
  }, {
    category: 'api',
    label: `POST /api/images (${file.name})`,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(parseApiError(body, 'Image upload failed.'));
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

export async function postMeetupLocation(
  agreementId: string,
  lat: number,
  lng: number,
): Promise<{
  etaMinutes: number;
  progressPercent: number;
  otherParty: { etaMinutes?: number; progressPercent?: number };
}> {
  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/agreements/${agreementId}/location`,
    {
      method: 'POST',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
    },
    {
      category: 'meetup',
      label: `POST /api/v1/agreements/${agreementId}/location`,
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to update meetup location');
  }

  return response.json();
}

export async function sendPushNotification(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body: string;
  listingId?: string;
}): Promise<void> {
  if (!isApiConfigured()) {
    return;
  }

  const response = await loggedFetch(`${getApiBaseUrl()}/api/notifications/push`, {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to send push notification');
  }
}

export interface BffListingResponse {
  id: string;
  title: string;
  titleLower?: string;
  description: string;
  price: number;
  imageUrls: string[];
  imageUrl: string;
  sellerId: string;
  sellerName: string;
  communityIds: string[];
  primaryCategoryId: string;
  categoryIds: string[];
  status: 'active' | 'sold' | 'removed';
  createdAt?: number | null;
  removedBy?: string;
  location?: {
    lat: number;
    lng: number;
    geohash?: string;
    city?: string;
    region?: string;
    label?: string;
  };
}

function mapBffListingResponse(data: BffListingResponse): Listing {
  return {
    id: data.id,
    title: data.title,
    titleLower: data.titleLower ?? data.title.toLowerCase(),
    description: data.description,
    price: data.price,
    imageUrls: data.imageUrls,
    imageUrl: data.imageUrl,
    sellerId: data.sellerId,
    sellerName: data.sellerName,
    communityIds: data.communityIds,
    primaryCategoryId: data.primaryCategoryId,
    categoryIds: data.categoryIds,
    status: data.status,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    removedBy: data.removedBy,
    location: data.location
      ? {
          lat: data.location.lat,
          lng: data.location.lng,
          geohash: data.location.geohash,
          city: data.location.city,
          region: data.location.region,
          label: data.location.label,
        }
      : undefined,
  };
}

async function parseBffListingError(response: Response, fallback: string): Promise<string> {
  const body = await response.text();
  return parseApiError(body, fallback);
}

export async function createListingViaBff(
  listing: Omit<
    Listing,
    'id' | 'status' | 'createdAt' | 'imageUrl' | 'titleLower' | 'primaryCategoryId' | 'categoryIds'
  > & {
    primaryCategoryId?: string;
    categoryIds?: string[];
  },
): Promise<Listing> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(`${getApiBaseUrl()}/api/v1/listings`, {
    method: 'POST',
    headers: {
      ...(await authHeaders(true)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      imageUrls: listing.imageUrls,
      sellerName: listing.sellerName,
      communityIds: listing.communityIds,
      primaryCategoryId: listing.primaryCategoryId,
      categoryIds: listing.categoryIds,
      location: listing.location,
    }),
  }, {
    category: 'listing',
    label: 'POST /api/v1/listings',
  });

  if (!response.ok) {
    throw new Error(await parseBffListingError(response, 'Failed to create listing'));
  }

  const data = (await response.json()) as BffListingResponse;
  return mapBffListingResponse(data);
}

export async function updateListingViaBff(
  listingId: string,
  listing: Omit<
    Listing,
    | 'id'
    | 'status'
    | 'createdAt'
    | 'imageUrl'
    | 'sellerId'
    | 'sellerName'
    | 'titleLower'
    | 'primaryCategoryId'
    | 'categoryIds'
    | 'location'
  > & {
    primaryCategoryId?: string;
    categoryIds?: string[];
    location?: Listing['location'];
  },
): Promise<Listing> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(`${getApiBaseUrl()}/api/v1/listings/${listingId}`, {
    method: 'PATCH',
    headers: {
      ...(await authHeaders(true)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      imageUrls: listing.imageUrls.filter(Boolean),
      communityIds: listing.communityIds,
      primaryCategoryId: listing.primaryCategoryId,
      categoryIds: listing.categoryIds,
      location: listing.location,
    }),
  }, {
    category: 'listing',
    label: `PATCH /api/v1/listings/${listingId}`,
  });

  if (!response.ok) {
    throw new Error(await parseBffListingError(response, 'Failed to update listing'));
  }

  const data = (await response.json()) as BffListingResponse;
  return mapBffListingResponse(data);
}

export async function removeListingViaBff(listingId: string): Promise<Listing> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(`${getApiBaseUrl()}/api/v1/listings/${listingId}/remove`, {
    method: 'POST',
    headers: await authHeaders(true),
  }, {
    category: 'listing',
    label: `POST /api/v1/listings/${listingId}/remove`,
  });

  if (!response.ok) {
    throw new Error(await parseBffListingError(response, 'Failed to remove listing'));
  }

  const data = (await response.json()) as BffListingResponse;
  return mapBffListingResponse(data);
}

export interface BffMessageResponse {
  id: string;
  listingId: string;
  senderId: string;
  senderName: string;
  text: string;
  recipientId?: string;
  createdAt?: number | null;
}

function mapBffMessageResponse(data: BffMessageResponse): Message {
  return {
    id: data.id,
    listingId: data.listingId,
    senderId: data.senderId,
    senderName: data.senderName,
    text: data.text,
    recipientId: data.recipientId,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
  };
}

async function parseBffMessageError(response: Response, fallback: string): Promise<string> {
  const body = await response.text();
  return parseApiError(body, fallback);
}

export async function sendListingMessageViaBff(
  listingId: string,
  senderName: string,
  input: { text: string; recipientId?: string },
): Promise<Message> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/listings/${listingId}/messages`,
    {
      method: 'POST',
      headers: {
        ...(await authHeaders(true)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: input.text,
        senderName,
        recipientId: input.recipientId,
      }),
    },
    {
      category: 'message',
      label: `POST /api/v1/listings/${listingId}/messages`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffMessageError(response, 'Failed to send message'));
  }

  const data = (await response.json()) as { message: BffMessageResponse };
  return mapBffMessageResponse(data.message);
}

export interface BffUserProfileResponse {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photoUrl?: string;
  communityIds: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  moderatorCommunityIds: string[];
  profileComplete?: boolean;
  accountSetupComplete?: boolean;
  authProvider?: 'password' | 'google.com';
}

function mapBffUserProfile(data: BffUserProfileResponse) {
  return { ...data };
}

async function parseBffUserError(response: Response, fallback: string): Promise<string> {
  const body = await response.text();
  return parseApiError(body, fallback);
}

export async function patchUserViaBff(payload: {
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  accountSetupComplete?: boolean;
  profileComplete?: boolean;
}): Promise<BffUserProfileResponse> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(`${getApiBaseUrl()}/api/v1/users/me`, {
    method: 'PATCH',
    headers: {
      ...(await authHeaders(true)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, {
    category: 'api',
    label: 'PATCH /api/v1/users/me',
  });

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to update profile'));
  }

  return mapBffUserProfile((await response.json()) as BffUserProfileResponse);
}

export async function findUserByEmailViaBff(email: string): Promise<BffUserProfileResponse> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const params = new URLSearchParams({ email });
  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/users/by-email?${params.toString()}`,
    {
      headers: await authHeaders(true),
    },
    {
      category: 'api',
      label: 'GET /api/v1/users/by-email',
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to look up user'));
  }

  return mapBffUserProfile((await response.json()) as BffUserProfileResponse);
}

export async function blockUserViaBff(blockedUserId: string): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/users/me/blocks/${blockedUserId}`,
    {
      method: 'POST',
      headers: await authHeaders(true),
    },
    {
      category: 'api',
      label: `POST /api/v1/users/me/blocks/${blockedUserId}`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to block user'));
  }
}

export async function unblockUserViaBff(blockedUserId: string): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/users/me/blocks/${blockedUserId}`,
    {
      method: 'DELETE',
      headers: await authHeaders(true),
    },
    {
      category: 'api',
      label: `DELETE /api/v1/users/me/blocks/${blockedUserId}`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to unblock user'));
  }
}

export async function joinCommunityViaBff(communityId: string): Promise<string[]> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/communities/${communityId}/join`,
    {
      method: 'POST',
      headers: await authHeaders(true),
    },
    {
      category: 'api',
      label: `POST /api/v1/communities/${communityId}/join`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to join community'));
  }

  const data = (await response.json()) as { communityIds: string[] };
  return data.communityIds;
}

export async function leaveCommunityViaBff(communityId: string): Promise<string[]> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/communities/${communityId}/leave`,
    {
      method: 'POST',
      headers: await authHeaders(true),
    },
    {
      category: 'api',
      label: `POST /api/v1/communities/${communityId}/leave`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to leave community'));
  }

  const data = (await response.json()) as { communityIds: string[] };
  return data.communityIds;
}

export async function fetchCommunityModeratorsViaBff(
  communityId: string,
): Promise<BffUserProfileResponse[]> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/communities/${communityId}/moderators`,
    {
      headers: await authHeaders(true),
    },
    {
      category: 'api',
      label: `GET /api/v1/communities/${communityId}/moderators`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to load moderators'));
  }

  const data = (await response.json()) as { moderators: BffUserProfileResponse[] };
  return data.moderators.map(mapBffUserProfile);
}

export async function grantCommunityModeratorViaBff(
  communityId: string,
  targetUid: string,
): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/communities/${communityId}/moderators`,
    {
      method: 'POST',
      headers: {
        ...(await authHeaders(true)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: targetUid }),
    },
    {
      category: 'api',
      label: `POST /api/v1/communities/${communityId}/moderators`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to grant moderator'));
  }
}

export async function revokeCommunityModeratorViaBff(
  communityId: string,
  targetUid: string,
): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/communities/${communityId}/moderators/${targetUid}`,
    {
      method: 'DELETE',
      headers: await authHeaders(true),
    },
    {
      category: 'api',
      label: `DELETE /api/v1/communities/${communityId}/moderators/${targetUid}`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to revoke moderator'));
  }
}

export interface BffCommunityResponse {
  id: string;
  name: string;
  type: 'admin' | 'user' | 'system';
  description: string;
}

export async function createCommunityViaBff(
  name: string,
  description: string,
): Promise<BffCommunityResponse> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(`${getApiBaseUrl()}/api/v1/communities`, {
    method: 'POST',
    headers: {
      ...(await authHeaders(true)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description }),
  }, {
    category: 'api',
    label: 'POST /api/v1/communities',
  });

  if (!response.ok) {
    throw new Error(await parseBffUserError(response, 'Failed to create community'));
  }

  return (await response.json()) as BffCommunityResponse;
}

export interface BffAgreementResponse {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  price: number;
  meetupLat: number;
  meetupLng: number;
  meetupAddress?: string | null;
  meetupAt?: number | null;
  depositAmount: number;
  depositPaidAt?: number | null;
  status: Agreement['status'];
  cancelledBy?: string | null;
  buyerEtaMinutes?: number;
  buyerProgressPercent?: number;
  sellerEtaMinutes?: number;
  sellerProgressPercent?: number;
}

function mapBffAgreementResponse(data: BffAgreementResponse): Agreement {
  return {
    id: data.id,
    listingId: data.listingId,
    buyerId: data.buyerId,
    buyerName: data.buyerName,
    sellerId: data.sellerId,
    price: data.price,
    meetupLat: data.meetupLat,
    meetupLng: data.meetupLng,
    meetupAddress: data.meetupAddress ?? undefined,
    meetupAt: data.meetupAt ? new Date(data.meetupAt) : undefined,
    depositAmount: data.depositAmount,
    depositPaidAt: data.depositPaidAt ? new Date(data.depositPaidAt) : undefined,
    status: data.status,
    cancelledBy: data.cancelledBy ?? undefined,
    buyerEtaMinutes: data.buyerEtaMinutes,
    buyerProgressPercent: data.buyerProgressPercent,
    sellerEtaMinutes: data.sellerEtaMinutes,
    sellerProgressPercent: data.sellerProgressPercent,
  };
}

async function parseBffAgreementError(response: Response, fallback: string): Promise<string> {
  const body = await response.text();
  return parseApiError(body, fallback);
}

async function postAgreementAction(
  agreementId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<Agreement> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/agreements/${agreementId}/${action}`,
    {
      method: 'POST',
      headers: {
        ...(await authHeaders(true)),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    {
      category: 'agreement',
      label: `POST /api/v1/agreements/${agreementId}/${action}`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffAgreementError(response, `Failed to ${action} FirmShake`));
  }

  const data = (await response.json()) as { agreement: BffAgreementResponse };
  return mapBffAgreementResponse(data.agreement);
}

export async function proposeMeetupAgreementViaBff(input: {
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
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/agreements`,
    {
      method: 'POST',
      headers: {
        ...(await authHeaders(true)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...input,
        meetupAt: input.meetupAt.toISOString(),
      }),
    },
    {
      category: 'agreement',
      label: 'POST /api/v1/agreements',
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffAgreementError(response, 'Failed to propose FirmShake'));
  }

  const data = (await response.json()) as { agreement: BffAgreementResponse };
  return mapBffAgreementResponse(data.agreement);
}

export async function acceptMeetupProposalViaBff(
  agreementId: string,
  _sellerId: string,
): Promise<void> {
  await postAgreementAction(agreementId, 'accept');
}

export async function declineMeetupProposalViaBff(
  agreementId: string,
  _sellerId: string,
): Promise<void> {
  await postAgreementAction(agreementId, 'decline');
}

export async function cancelFirmShakeRequestViaBff(
  agreementId: string,
  _buyerId: string,
): Promise<void> {
  await postAgreementAction(agreementId, 'cancel');
}

export async function confirmMeetupDepositViaBff(
  agreementId: string,
  _buyerId: string,
): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error(getApiUnavailableMessage());
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/agreements/${agreementId}/deposit`,
    {
      method: 'POST',
      headers: {
        ...(await authHeaders(true)),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
    {
      category: 'agreement',
      label: `POST /api/v1/agreements/${agreementId}/deposit`,
    },
  );

  if (!response.ok) {
    throw new Error(await parseBffAgreementError(response, 'Failed to confirm deposit'));
  }

  const data = (await response.json()) as {
    mode?: string;
    checkoutUrl?: string;
    agreement?: BffAgreementResponse;
  };

  if (data.mode === 'stripe' && data.checkoutUrl) {
    window.location.assign(data.checkoutUrl);
  }
}

export async function startMeetupEnRouteViaBff(agreementId: string): Promise<void> {
  await postAgreementAction(agreementId, 'en-route');
}

export async function cancelActiveAgreementViaBff(agreementId: string): Promise<void> {
  await postAgreementAction(agreementId, 'cancel');
}

export interface BffInboxStateResponse {
  listingId: string;
  buyerId?: string | null;
  hasViewed: boolean;
  isArchived?: boolean;
  lastReadAt?: number | null;
  archivedAt?: number | null;
}

export interface BffInboxThreadResponse {
  id: string;
  listingId: string;
  buyerId?: string | null;
  buyerName?: string | null;
  listingTitle: string;
  listingImageUrl: string;
  listingStatus?: string;
  sellerId: string;
  sellerName: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageSenderName: string;
  lastMessageAt?: number | null;
  inboxState: BffInboxStateResponse;
}

export interface BffInboxThreadsPageResponse {
  threads: BffInboxThreadResponse[];
  nextCursor?: string | null;
  hasMore: boolean;
}

function mapBffInboxState(data: BffInboxStateResponse) {
  return {
    listingId: data.listingId,
    buyerId: data.buyerId ?? undefined,
    hasViewed: data.hasViewed,
    isArchived: data.isArchived,
    lastReadAt: data.lastReadAt ? new Date(data.lastReadAt) : undefined,
    archivedAt: data.archivedAt ? new Date(data.archivedAt) : undefined,
  };
}

function mapBffInboxThread(data: BffInboxThreadResponse) {
  return {
    id: data.id,
    listingId: data.listingId,
    buyerId: data.buyerId ?? undefined,
    buyerName: data.buyerName ?? undefined,
    listingTitle: data.listingTitle,
    listingImageUrl: data.listingImageUrl,
    listingStatus: data.listingStatus as import('@/types').Listing['status'] | undefined,
    sellerId: data.sellerId,
    sellerName: data.sellerName,
    lastMessageText: data.lastMessageText,
    lastMessageSenderId: data.lastMessageSenderId,
    lastMessageSenderName: data.lastMessageSenderName,
    lastMessageAt: data.lastMessageAt ? new Date(data.lastMessageAt) : undefined,
    inboxState: mapBffInboxState(data.inboxState),
  };
}

async function parseBffInboxError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export async function fetchInboxThreadsViaBff(options?: {
  cursor?: string;
  limit?: number;
}): Promise<{
  threads: ReturnType<typeof mapBffInboxThread>[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (options?.cursor) {
    params.set('cursor', options.cursor);
  }
  if (options?.limit != null) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();
  const response = await loggedFetch(
    `/api/v1/inbox/threads${query ? `?${query}` : ''}`,
    { headers: await authHeaders() },
  );

  if (!response.ok) {
    throw new Error(await parseBffInboxError(response, 'Failed to load inbox threads'));
  }

  const data = (await response.json()) as BffInboxThreadsPageResponse;
  return {
    threads: data.threads.map(mapBffInboxThread),
    nextCursor: data.nextCursor ?? undefined,
    hasMore: data.hasMore,
  };
}

async function postInboxThreadAction(
  threadKey: string,
  action: 'read' | 'archive' | 'unarchive',
  fallback: string,
): Promise<ReturnType<typeof mapBffInboxState>> {
  const response = await loggedFetch(`/api/v1/inbox/threads/${encodeURIComponent(threadKey)}/${action}`, {
    method: 'POST',
    headers: await authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseBffInboxError(response, fallback));
  }

  const data = (await response.json()) as { inboxState: BffInboxStateResponse };
  return mapBffInboxState(data.inboxState);
}

export async function markInboxThreadReadViaBff(threadKey: string) {
  return postInboxThreadAction(threadKey, 'read', 'Failed to mark conversation read');
}

export async function archiveInboxThreadViaBff(threadKey: string) {
  return postInboxThreadAction(threadKey, 'archive', 'Failed to archive conversation');
}

export async function unarchiveInboxThreadViaBff(threadKey: string) {
  return postInboxThreadAction(threadKey, 'unarchive', 'Failed to unarchive conversation');
}

export { getApiBaseUrl, getApiUnavailableMessage, isApiConfigured } from '@/utils/apiBaseUrl';
