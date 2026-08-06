/** Minimal route shape for tabs-shell navigation checks. */
export interface TabsRouteLike {
  path: string;
}

const TAB_FEED_ROOTS = ['/tabs/buying', '/tabs/selling', '/tabs/inbox'] as const;

export function normalizeRoutePath(path: string): string {
  return path.replace(/\/$/, '') || '/';
}

export function isWithinTabsShell(path: string): boolean {
  const normalized = normalizeRoutePath(path);
  return normalized === '/tabs' || normalized.startsWith('/tabs/');
}

/** True when switching between routes inside the Ionic tabs shell (e.g. home → buying). */
export function isTabsShellSwitch(from: TabsRouteLike, to: TabsRouteLike): boolean {
  return isWithinTabsShell(from.path) && isWithinTabsShell(to.path);
}

/** Buying, Selling, or Inbox tab roots (not nested message routes). */
export function isDirectTabFeedPath(path: string): boolean {
  const normalized = normalizeRoutePath(path);
  return TAB_FEED_ROOTS.includes(normalized as (typeof TAB_FEED_ROOTS)[number]);
}

export { getTabBootTitle } from '@/router/pageTitle';

/**
 * Tab routes should not block navigation on Firestore profile fetches — show the
 * shell immediately and verify profile/MFA in the background.
 */
export function shouldDeferPostAuthChecks(from: TabsRouteLike, to: TabsRouteLike): boolean {
  return isTabsShellSwitch(from, to) || isWithinTabsShell(to.path);
}
