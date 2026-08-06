import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import type { Listing, UserProfile } from '@/types';

export function isSuperAdmin(profile: UserProfile | null | undefined): boolean {
  if (!profile) {
    return false;
  }

  return profile.isSuperAdmin || profile.isAdmin;
}

export function isCommunityModerator(
  profile: UserProfile | null | undefined,
  communityId: string,
): boolean {
  if (!profile || communityId === ALL_COMMUNITY_ID) {
    return false;
  }

  if (isSuperAdmin(profile)) {
    return true;
  }

  return profile.moderatorCommunityIds.includes(communityId);
}

export function listingModeratableCommunityIds(listing: Listing): string[] {
  return listing.communityIds.filter((communityId) => communityId !== ALL_COMMUNITY_ID);
}

export function canModerateListing(
  profile: UserProfile | null | undefined,
  listing: Listing,
): boolean {
  if (!profile || listing.status !== 'active') {
    return false;
  }

  if (isSuperAdmin(profile)) {
    return true;
  }

  const moderatableCommunities = listingModeratableCommunityIds(listing);
  if (moderatableCommunities.length === 0) {
    return false;
  }

  return moderatableCommunities.some((communityId) =>
    profile.moderatorCommunityIds.includes(communityId),
  );
}

export function canDelistOwnListing(
  profile: UserProfile | null | undefined,
  listing: Listing,
): boolean {
  if (!profile || listing.status !== 'active') {
    return false;
  }

  return listing.sellerId === profile.uid;
}

export function canRemoveListing(
  profile: UserProfile | null | undefined,
  listing: Listing,
): boolean {
  return canDelistOwnListing(profile, listing) || canModerateListing(profile, listing);
}

export function canManageCommunityModerators(
  profile: UserProfile | null | undefined,
  communityId: string,
): boolean {
  if (communityId === ALL_COMMUNITY_ID) {
    return isSuperAdmin(profile);
  }

  return isCommunityModerator(profile, communityId);
}

export function canModifyTargetModeratorAccess(
  actor: UserProfile | null | undefined,
  target: UserProfile | null | undefined,
): boolean {
  if (!actor || !target) {
    return false;
  }

  if (isSuperAdmin(target)) {
    return false;
  }

  return isSuperAdmin(actor);
}
