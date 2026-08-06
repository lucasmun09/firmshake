export type CommunityType = 'admin' | 'user' | 'system';

export interface Community {
  id: string;
  name: string;
  type: CommunityType;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  sortOrder?: number;
}

export interface ListingLocation {
  lat: number;
  lng: number;
  geohash?: string;
  city?: string;
  region?: string;
  label?: string;
}

export interface Listing {
  id: string;
  title: string;
  /** Lowercase title for prefix/range queries. */
  titleLower?: string;
  description: string;
  price: number;
  /** Primary image (first in imageUrls). Kept for backward compatibility. */
  imageUrl: string;
  imageUrls: string[];
  sellerId: string;
  sellerName: string;
  communityIds: string[];
  primaryCategoryId: string;
  categoryIds: string[];
  location?: ListingLocation;
  status: 'active' | 'sold' | 'removed';
  createdAt?: Date;
  removedAt?: Date;
  removedBy?: string;
}

/** Denormalized listing row in communityFeeds/{communityId}/listings/{listingId}. */
export interface ListingFeedEntry extends Listing {
  listingId: string;
  feedCommunityId: string;
}

export type AgreementStatus =
  | 'proposed'
  | 'accepted'
  | 'deposit_paid'
  | 'en_route'
  | 'completed'
  | 'no_show_buyer'
  | 'no_show_seller'
  | 'cancelled';

export const MEETUP_DEPOSIT_AMOUNT = 10;
export const MIN_MEETUP_DEPOSIT_AMOUNT = 10;

export interface Agreement {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  price: number;
  meetupLat: number;
  meetupLng: number;
  meetupAddress?: string;
  meetupAt?: Date;
  depositAmount: number;
  depositPaidAt?: Date;
  status: AgreementStatus;
  cancelledBy?: string;
  buyerEtaMinutes?: number;
  buyerProgressPercent?: number;
  sellerEtaMinutes?: number;
  sellerProgressPercent?: number;
}

export type MeetupMode = 'seller_proposed' | 'mutually_agreed';

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photoUrl?: string;
  communityIds: string[];
  /** @deprecated Use isSuperAdmin */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  moderatorCommunityIds: string[];
  profileComplete?: boolean;
  /** False until MFA enrollment finishes for email/password sign-up. */
  accountSetupComplete?: boolean;
  authProvider?: 'password' | 'google.com';
  /** Created via controlpanel; skips MFA and uses fixed verification codes. */
  isTestAccount?: boolean;
  testVerificationCode?: string;
  testPhone?: string;
}

export interface Message {
  id: string;
  listingId: string;
  senderId: string;
  senderName: string;
  text: string;
  recipientId?: string;
  createdAt?: Date;
}

export interface ListingConversation {
  buyerId: string;
  buyerName: string;
  messages: Message[];
  lastMessage?: Message;
  lastMessageAt?: Date;
}

export type NotificationType = 'message' | 'meetup' | 'system';

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body: string;
  listingId?: string;
  read: boolean;
  createdAt?: Date;
}

export interface MessageThread {
  id: string;
  listingId: string;
  /** Set for seller-side threads (one row per buyer). */
  buyerId?: string;
  buyerName?: string;
  listingTitle: string;
  listingImageUrl: string;
  listingStatus?: Listing['status'];
  sellerId: string;
  sellerName: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageSenderName: string;
  lastMessageAt?: Date;
}

export interface InboxState {
  listingId: string;
  buyerId?: string;
  lastReadAt?: Date;
  hasViewed: boolean;
  /** Per-user archive flag; absent or false = active. */
  isArchived?: boolean;
  archivedAt?: Date;
}

export interface ListingThread {
  listing: Listing;
  lastMessage?: Message;
  unreadCount: number;
}
