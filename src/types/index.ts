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
  sellerName: string;
  communityIds: string[];
}

export type MeetupMode = 'seller_proposed' | 'mutually_agreed';

export type AgreementStatus =
  | 'proposed'
  | 'accepted'
  | 'deposit_paid'
  | 'en_route'
  | 'completed'
  | 'no_show_buyer'
  | 'no_show_seller'
  | 'cancelled';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  communityIds: string[];
  isAdmin: boolean;
}
