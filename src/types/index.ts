export type CommunityType = 'admin' | 'user' | 'system';

export interface Community {
  id: string;
  name: string;
  type: CommunityType;
  description: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  sellerId: string;
  sellerName: string;
  communityIds: string[];
  status: 'active' | 'sold' | 'removed';
  createdAt?: Date;
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
  meetupAt?: Date;
  depositAmount: number;
  depositPaidAt?: Date;
  status: AgreementStatus;
  buyerEtaMinutes?: number;
  buyerProgressPercent?: number;
  sellerEtaMinutes?: number;
  sellerProgressPercent?: number;
}

export type MeetupMode = 'seller_proposed' | 'mutually_agreed';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  communityIds: string[];
  isAdmin: boolean;
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
  listingTitle: string;
  listingImageUrl: string;
  sellerId: string;
  sellerName: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageSenderName: string;
  lastMessageAt?: Date;
}

export interface ListingThread {
  listing: Listing;
  lastMessage?: Message;
  unreadCount: number;
}
