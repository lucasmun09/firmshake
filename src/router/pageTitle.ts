import type { RouteLocationNormalized } from 'vue-router';

function normalizeRoutePath(path: string): string {
  return path.replace(/\/$/, '') || '/';
}

export const APP_TITLE_PREFIX = 'firm-shake';

/** Tab root paths shown in the index.html boot shell. */
export const TAB_PATH_TITLES: Record<string, string> = {
  '/tabs/home': 'Browse',
  '/tabs/savedlistings': 'Saved',
  '/tabs/login-create': 'Login/Create',
  '/tabs/buying': 'Buying',
  '/tabs/selling': 'Selling',
  '/tabs/inbox': 'Inbox',
  '/tabs/profile': 'Settings',
};

const ROUTE_NAME_TITLES: Record<string, string> = {
  Welcome: 'Welcome',
  Home: 'Browse',
  LoginCreate: 'Login/Create',
  Communities: 'Communities',
  Buying: 'Buying',
  BuyingListingMessages: 'Messages',
  Selling: 'Selling',
  SellingListingMessages: 'Messages',
  Sell: 'Sell',
  Inbox: 'Inbox',
  InboxListingMessages: 'Messages',
  FirmShakeView: 'FirmShake',
  Profile: 'Settings',
  SavedListings: 'Saved',
  BlockedUsers: 'Blocked Users',
  CreateCommunity: 'Create Community',
  Login: 'Login',
  Register: 'Register',
  ForgotPassword: 'Forgot Password',
  ResetPassword: 'Reset Password',
  CompleteProfile: 'Complete Profile',
  MfaEnroll: 'MFA',
  MfaChallenge: 'MFA',
  Logs: 'Logs',
  MeetupProposal: 'Meetup',
  EditListing: 'Edit Listing',
  ListingDetail: 'Listing',
  SellerProfile: 'Seller',
  Meetup: 'Meetup',
};

export function getTabBootTitle(path: string): string | undefined {
  return TAB_PATH_TITLES[normalizeRoutePath(path)];
}

export function resolveRouteTitle(route: RouteLocationNormalized): string {
  const metaTitle = route.meta.title;
  if (typeof metaTitle === 'string' && metaTitle.trim()) {
    return metaTitle.trim();
  }

  const routeName = typeof route.name === 'string' ? route.name : '';
  if (routeName && ROUTE_NAME_TITLES[routeName]) {
    return ROUTE_NAME_TITLES[routeName];
  }

  const tabTitle = getTabBootTitle(route.path);
  if (tabTitle) {
    return tabTitle;
  }

  if (routeName) {
    return routeName.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  return 'FirmShake';
}

export function formatDocumentTitle(pageTitle: string): string {
  return `${APP_TITLE_PREFIX} - ${pageTitle}`;
}

export function updateDocumentTitle(route: RouteLocationNormalized): void {
  document.title = formatDocumentTitle(resolveRouteTitle(route));
}
