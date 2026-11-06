#!/usr/bin/env node
/**
 * One-time migration: flat views/services → feature-based layout.
 * Run from repo root: node scripts/reorganize-features.mjs
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'src');

const moves = [
  // common services
  ['services/firebase.ts', 'common/services/firebase.ts'],
  ['services/firestoreAuth.ts', 'common/services/firestoreAuth.ts'],
  ['services/api.ts', 'common/services/api.ts'],
  ['services/images.ts', 'common/services/images.ts'],
  ['services/persistentImageCache.ts', 'common/services/persistentImageCache.ts'],
  ['services/pushNotifications.ts', 'common/services/pushNotifications.ts'],
  ['services/blocks.ts', 'common/services/blocks.ts'],
  ['services/recaptchaGate.ts', 'common/services/recaptchaGate.ts'],
  ['services/appBootstrap.ts', 'common/services/appBootstrap.ts'],
  ['services/locationTracking.ts', 'common/services/locationTracking.ts'],
  ['services/users.ts', 'common/services/users.ts'],
  ['services/agreements.ts', 'common/services/agreements.ts'],
  // auth
  ['services/auth.ts', 'features/auth/services/auth.ts'],
  ['services/mfa.ts', 'features/auth/services/mfa.ts'],
  ['services/postAuthFlow.ts', 'features/auth/services/postAuthFlow.ts'],
  ['views/LoginPage.vue', 'features/auth/views/LoginPage.vue'],
  ['views/RegisterPage.vue', 'features/auth/views/RegisterPage.vue'],
  ['views/MfaChallengePage.vue', 'features/auth/views/MfaChallengePage.vue'],
  ['views/MfaEnrollPage.vue', 'features/auth/views/MfaEnrollPage.vue'],
  ['views/CompleteProfilePage.vue', 'features/auth/views/CompleteProfilePage.vue'],
  ['utils/authErrors.ts', 'features/auth/utils/authErrors.ts'],
  ['utils/authTransition.ts', 'features/auth/utils/authTransition.ts'],
  // listings
  ['services/listings.ts', 'features/listings/services/listings.ts'],
  ['services/listingFeed.ts', 'features/listings/services/listingFeed.ts'],
  ['services/listingSearch.ts', 'features/listings/services/listingSearch.ts'],
  ['services/categories.ts', 'features/listings/services/categories.ts'],
  ['views/HomePage.vue', 'features/listings/views/HomePage.vue'],
  ['views/CreateListingPage.vue', 'features/listings/views/CreateListingPage.vue'],
  ['views/ListingDetailPage.vue', 'features/listings/views/ListingDetailPage.vue'],
  ['components/ListingPhotoPicker.vue', 'features/listings/components/ListingPhotoPicker.vue'],
  ['components/ListingPhotoGallery.vue', 'features/listings/components/ListingPhotoGallery.vue'],
  ['utils/listingMapper.ts', 'features/listings/utils/listingMapper.ts'],
  ['utils/listingSearchDocument.ts', 'features/listings/utils/listingSearchDocument.ts'],
  ['utils/listingImages.ts', 'features/listings/utils/listingImages.ts'],
  ['utils/listingPhotoUpload.ts', 'features/listings/utils/listingPhotoUpload.ts'],
  ['utils/listingConversations.ts', 'features/listings/utils/listingConversations.ts'],
  ['utils/geohash.ts', 'features/listings/utils/geohash.ts'],
  ['data/seedCategories.ts', 'features/listings/data/seedCategories.ts'],
  ['constants/listingPhotos.ts', 'features/listings/constants/listingPhotos.ts'],
  ['types/listingPhotos.ts', 'features/listings/types/listingPhotos.ts'],
  // messages
  ['services/messages.ts', 'features/messages/services/messages.ts'],
  ['services/threads.ts', 'features/messages/services/threads.ts'],
  ['services/inboxState.ts', 'features/messages/services/inboxState.ts'],
  ['services/notifications.ts', 'features/messages/services/notifications.ts'],
  ['views/InboxPage.vue', 'features/messages/views/InboxPage.vue'],
  ['views/ListingMessagesPage.vue', 'features/messages/views/ListingMessagesPage.vue'],
  ['components/ListingChatSection.vue', 'features/messages/components/ListingChatSection.vue'],
  ['components/ListingThreadActions.vue', 'features/messages/components/ListingThreadActions.vue'],
  ['components/NotificationPanel.vue', 'features/messages/components/NotificationPanel.vue'],
  ['composables/useListingMessages.ts', 'features/messages/composables/useListingMessages.ts'],
  ['composables/useListingChat.ts', 'features/messages/composables/useListingChat.ts'],
  ['composables/useListingNestedChatScroll.ts', 'features/messages/composables/useListingNestedChatScroll.ts'],
  // communities
  ['services/communities.ts', 'features/communities/services/communities.ts'],
  ['views/CommunitiesPage.vue', 'features/communities/views/CommunitiesPage.vue'],
  ['views/CreateCommunityPage.vue', 'features/communities/views/CreateCommunityPage.vue'],
  ['components/CommunityModeratorPanel.vue', 'features/communities/components/CommunityModeratorPanel.vue'],
  ['components/CreateCommunityForm.vue', 'features/communities/components/CreateCommunityForm.vue'],
  ['data/seedCommunities.ts', 'features/communities/data/seedCommunities.ts'],
  // buying / selling / profile / meetups / shell
  ['views/BuyingPage.vue', 'features/buying/views/BuyingPage.vue'],
  ['views/SellingPage.vue', 'features/selling/views/SellingPage.vue'],
  ['views/ListingFirmShakesPage.vue', 'features/selling/views/ListingFirmShakesPage.vue'],
  ['views/ProfilePage.vue', 'features/profile/views/ProfilePage.vue'],
  ['components/ProfilePhotoEditor.vue', 'features/profile/components/ProfilePhotoEditor.vue'],
  ['views/MeetupPage.vue', 'features/meetups/views/MeetupPage.vue'],
  ['views/MeetupProposalPage.vue', 'features/meetups/views/MeetupProposalPage.vue'],
  ['views/FirmShakeViewPage.vue', 'features/meetups/views/FirmShakeViewPage.vue'],
  ['components/FirmShakeInlinePanel.vue', 'features/meetups/components/FirmShakeInlinePanel.vue'],
  ['components/ListingMeetupSection.vue', 'features/meetups/components/ListingMeetupSection.vue'],
  ['components/SellerFirmShakeList.vue', 'features/meetups/components/SellerFirmShakeList.vue'],
  ['utils/meetupLocation.ts', 'features/meetups/utils/meetupLocation.ts'],
  ['types/meetupLocation.ts', 'features/meetups/types/meetupLocation.ts'],
  ['views/TabsPage.vue', 'features/shell/views/TabsPage.vue'],
  // common composables
  ['composables/useLazyReveal.ts', 'common/composables/useLazyReveal.ts'],
  ['composables/useParticipantProfiles.ts', 'common/composables/useParticipantProfiles.ts'],
];

for (const [from, to] of moves) {
  const fromPath = path.join(src, from);
  const toPath = path.join(src, to);
  if (!fs.existsSync(fromPath)) {
    console.warn(`skip (missing): ${from}`);
    continue;
  }
  fs.mkdirSync(path.dirname(toPath), { recursive: true });
  fs.renameSync(fromPath, toPath);
  console.log(`moved ${from} → ${to}`);
}

const importReplacements = [
  // services
  ['@/common/services/firebase', '@/common/services/firebase'],
  ['@/common/services/firestoreAuth', '@/common/services/firestoreAuth'],
  ['@/common/services/api', '@/common/services/api'],
  ['@/common/services/images', '@/common/services/images'],
  ['@/common/services/persistentImageCache', '@/common/services/persistentImageCache'],
  ['@/common/services/pushNotifications', '@/common/services/pushNotifications'],
  ['@/common/services/blocks', '@/common/services/blocks'],
  ['@/common/services/recaptchaGate', '@/common/services/recaptchaGate'],
  ['@/common/services/appBootstrap', '@/common/services/appBootstrap'],
  ['@/common/services/locationTracking', '@/common/services/locationTracking'],
  ['@/common/services/users', '@/common/services/users'],
  ['@/common/services/agreements', '@/common/services/agreements'],
  ['@/features/auth/services/auth', '@/features/auth/services/auth'],
  ['@/features/auth/services/mfa', '@/features/auth/services/mfa'],
  ['@/features/auth/services/postAuthFlow', '@/features/auth/services/postAuthFlow'],
  ['@/features/listings/services/listings', '@/features/listings/services/listings'],
  ['@/features/listings/services/listingFeed', '@/features/listings/services/listingFeed'],
  ['@/features/listings/services/listingSearch', '@/features/listings/services/listingSearch'],
  ['@/features/listings/services/categories', '@/features/listings/services/categories'],
  ['@/features/messages/services/messages', '@/features/messages/services/messages'],
  ['@/features/messages/services/threads', '@/features/messages/services/threads'],
  ['@/features/messages/services/inboxState', '@/features/messages/services/inboxState'],
  ['@/features/messages/services/notifications', '@/features/messages/services/notifications'],
  ['@/features/communities/services/communities', '@/features/communities/services/communities'],
  // views
  ['@/features/auth/views/LoginPage.vue', '@/features/auth/views/LoginPage.vue'],
  ['@/features/auth/views/RegisterPage.vue', '@/features/auth/views/RegisterPage.vue'],
  ['@/features/auth/views/MfaChallengePage.vue', '@/features/auth/views/MfaChallengePage.vue'],
  ['@/features/auth/views/MfaEnrollPage.vue', '@/features/auth/views/MfaEnrollPage.vue'],
  ['@/features/auth/views/CompleteProfilePage.vue', '@/features/auth/views/CompleteProfilePage.vue'],
  ['@/features/listings/views/HomePage.vue', '@/features/listings/views/HomePage.vue'],
  ['@/features/listings/views/CreateListingPage.vue', '@/features/listings/views/CreateListingPage.vue'],
  ['@/features/listings/views/ListingDetailPage.vue', '@/features/listings/views/ListingDetailPage.vue'],
  ['@/features/messages/views/InboxPage.vue', '@/features/messages/views/InboxPage.vue'],
  ['@/features/messages/views/ListingMessagesPage.vue', '@/features/messages/views/ListingMessagesPage.vue'],
  ['@/features/communities/views/CommunitiesPage.vue', '@/features/communities/views/CommunitiesPage.vue'],
  ['@/features/communities/views/CreateCommunityPage.vue', '@/features/communities/views/CreateCommunityPage.vue'],
  ['@/features/buying/views/BuyingPage.vue', '@/features/buying/views/BuyingPage.vue'],
  ['@/features/selling/views/SellingPage.vue', '@/features/selling/views/SellingPage.vue'],
  ['@/features/selling/views/ListingFirmShakesPage.vue', '@/features/selling/views/ListingFirmShakesPage.vue'],
  ['@/features/profile/views/ProfilePage.vue', '@/features/profile/views/ProfilePage.vue'],
  ['@/features/meetups/views/MeetupPage.vue', '@/features/meetups/views/MeetupPage.vue'],
  ['@/features/meetups/views/MeetupProposalPage.vue', '@/features/meetups/views/MeetupProposalPage.vue'],
  ['@/features/meetups/views/FirmShakeViewPage.vue', '@/features/meetups/views/FirmShakeViewPage.vue'],
  ['@/features/shell/views/TabsPage.vue', '@/features/shell/views/TabsPage.vue'],
  // utils
  ['@/features/auth/utils/authErrors', '@/features/auth/utils/authErrors'],
  ['@/features/auth/utils/authTransition', '@/features/auth/utils/authTransition'],
  ['@/features/listings/utils/listingMapper', '@/features/listings/utils/listingMapper'],
  ['@/features/listings/utils/listingSearchDocument', '@/features/listings/utils/listingSearchDocument'],
  ['@/features/listings/utils/listingImages', '@/features/listings/utils/listingImages'],
  ['@/features/listings/utils/listingPhotoUpload', '@/features/listings/utils/listingPhotoUpload'],
  ['@/features/listings/utils/listingConversations', '@/features/listings/utils/listingConversations'],
  ['@/features/listings/utils/geohash', '@/features/listings/utils/geohash'],
  ['@/features/meetups/utils/meetupLocation', '@/features/meetups/utils/meetupLocation'],
  // composables
  ['@/common/composables/useLazyReveal', '@/common/composables/useLazyReveal'],
  ['@/common/composables/useParticipantProfiles', '@/common/composables/useParticipantProfiles'],
  ['@/features/messages/composables/useListingMessages', '@/features/messages/composables/useListingMessages'],
  ['@/features/messages/composables/useListingChat', '@/features/messages/composables/useListingChat'],
  ['@/features/messages/composables/useListingNestedChatScroll', '@/features/messages/composables/useListingNestedChatScroll'],
  // components
  ['@/features/listings/components/ListingPhotoPicker.vue', '@/features/listings/components/ListingPhotoPicker.vue'],
  ['@/features/listings/components/ListingPhotoGallery.vue', '@/features/listings/components/ListingPhotoGallery.vue'],
  ['@/features/messages/components/ListingChatSection.vue', '@/features/messages/components/ListingChatSection.vue'],
  ['@/features/messages/components/ListingThreadActions.vue', '@/features/messages/components/ListingThreadActions.vue'],
  ['@/features/messages/components/NotificationPanel.vue', '@/features/messages/components/NotificationPanel.vue'],
  ['@/features/communities/components/CommunityModeratorPanel.vue', '@/features/communities/components/CommunityModeratorPanel.vue'],
  ['@/features/communities/components/CreateCommunityForm.vue', '@/features/communities/components/CreateCommunityForm.vue'],
  ['@/features/profile/components/ProfilePhotoEditor.vue', '@/features/profile/components/ProfilePhotoEditor.vue'],
  ['@/features/meetups/components/FirmShakeInlinePanel.vue', '@/features/meetups/components/FirmShakeInlinePanel.vue'],
  ['@/features/meetups/components/ListingMeetupSection.vue', '@/features/meetups/components/ListingMeetupSection.vue'],
  ['@/features/meetups/components/SellerFirmShakeList.vue', '@/features/meetups/components/SellerFirmShakeList.vue'],
  // data / types / constants
  ['@/features/listings/data/seedCategories', '@/features/listings/data/seedCategories'],
  ['@/features/communities/data/seedCommunities', '@/features/communities/data/seedCommunities'],
  ['@/features/listings/constants/listingPhotos', '@/features/listings/constants/listingPhotos'],
  ['@/features/meetups/types/meetupLocation', '@/features/meetups/types/meetupLocation'],
  ['@/features/listings/types/listingPhotos', '@/features/listings/types/listingPhotos'],
];

// Relative imports within moved service files
const relativeServiceReplacements = [
  ["from './firebase'", "from '@/common/services/firebase'"],
  ["from './firestoreAuth'", "from '@/common/services/firestoreAuth'"],
  ["from './api'", "from '@/common/services/api'"],
  ["from './images'", "from '@/common/services/images'"],
  ["from './persistentImageCache'", "from '@/common/services/persistentImageCache'"],
  ["from './pushNotifications'", "from '@/common/services/pushNotifications'"],
  ["from './blocks'", "from '@/common/services/blocks'"],
  ["from './recaptchaGate'", "from '@/common/services/recaptchaGate'"],
  ["from './appBootstrap'", "from '@/common/services/appBootstrap'"],
  ["from './locationTracking'", "from '@/common/services/locationTracking'"],
  ["from './users'", "from '@/common/services/users'"],
  ["from './agreements'", "from '@/common/services/agreements'"],
  ["from './auth'", "from '@/features/auth/services/auth'"],
  ["from './mfa'", "from '@/features/auth/services/mfa'"],
  ["from './postAuthFlow'", "from '@/features/auth/services/postAuthFlow'"],
  ["from './listings'", "from '@/features/listings/services/listings'"],
  ["from './listingFeed'", "from '@/features/listings/services/listingFeed'"],
  ["from './listingSearch'", "from '@/features/listings/services/listingSearch'"],
  ["from './categories'", "from '@/features/listings/services/categories'"],
  ["from './messages'", "from '@/features/messages/services/messages'"],
  ["from './threads'", "from '@/features/messages/services/threads'"],
  ["from './inboxState'", "from '@/features/messages/services/inboxState'"],
  ["from './notifications'", "from '@/features/messages/services/notifications'"],
  ["from './communities'", "from '@/features/communities/services/communities'"],
];

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, exts, files);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk(root, ['.ts', '.tsx', '.vue', '.mjs']);

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const [from, to] of importReplacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  if (file.includes(`${path.sep}src${path.sep}`)) {
    for (const [from, to] of relativeServiceReplacements) {
      if (content.includes(from)) {
        content = content.split(from).join(to);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`updated imports: ${path.relative(root, file)}`);
  }
}

// Clean empty dirs
for (const dir of ['services', 'views', 'composables', 'constants']) {
  const p = path.join(src, dir);
  if (fs.existsSync(p) && fs.readdirSync(p).length === 0) {
    fs.rmdirSync(p);
    console.log(`removed empty ${dir}/`);
  }
}

console.log('Done.');
