<template>
  <ion-page class="browse-page">
    <AppTopToolbar title="Browse">
      <AppTabRefreshingIndicator :active="showUpdatingIndicator" />
      <ion-toolbar class="app-toolbar-content">
        <AppContentFrame>
          <div class="search-filter-row">
            <button
              v-if="isMobileSidebar"
              type="button"
              class="mobile-filter-toggle"
              :aria-label="sidebarOpen ? 'Close browse filters' : 'Open browse filters'"
              :aria-expanded="sidebarOpen"
              @click="toggleSidebar"
            >
              <ion-icon :icon="menuOutline" aria-hidden="true" />
            </button>
            <ion-searchbar
              v-model="searchQuery"
              class="search-filter-row__search"
              placeholder="Search listings"
              :debounce="350"
              @ionInput="onSearchInput"
            />
          </div>

          <div v-if="currentUser" class="community-row">
            <ion-segment
              v-model="selectedCommunity"
              scrollable
              class="community-segment"
              @ionChange="onCommunityChange"
            >
              <ion-segment-button
                v-for="community in browseCommunities"
                :key="community.id"
                :value="community.id"
              >
                <ion-label>{{ community.name }}</ion-label>
              </ion-segment-button>
            </ion-segment>
            <ion-button
              fill="clear"
              class="add-community-btn"
              aria-label="Create community"
              router-link="/communities/create"
            >
              <ion-icon slot="icon-only" :icon="addOutline" />
            </ion-button>
          </div>
        </AppContentFrame>
      </ion-toolbar>
    </AppTopToolbar>

    <Teleport to="body">
      <div
        v-if="isMobileSidebar && sidebarOpen"
        class="browse-sidebar-backdrop"
        :style="mobileOverlayStyle"
        aria-hidden="true"
        @click="closeSidebar"
      />
    </Teleport>

    <ion-content ref="contentRef" @ionScroll="handleScroll">
      <AppContentFrame>
        <div class="browse-layout">
          <Teleport to="body" :disabled="!isMobileSidebar">
            <aside
              class="browse-sidebar"
              :class="{ 'browse-sidebar--open': sidebarOpen }"
              :style="isMobileSidebar ? mobileOverlayStyle : undefined"
              aria-label="Browse filters"
              :aria-hidden="isMobileSidebar && !sidebarOpen"
            >
              <MobileFilterDrawer
                v-if="isMobileSidebar"
                v-model:stack="filterPanelStack"
              >
                <template #root="{ push }">
                  <div class="sidebar-section">
                    <h2 class="sidebar-heading">Category</h2>
                    <MobileFilterNavRow
                      :value="selectedCategoryLabel"
                      aria-label="Choose category"
                      @click="push('category')"
                    />
                  </div>

                  <div class="sidebar-section">
                    <h2 class="sidebar-heading">Distance</h2>
                    <BrowseGeoFilter v-model="geoFilter" @apply="onGeoFilterApply" />
                  </div>
                </template>

                <template #panel-category="{ pop, popAll }">
                  <MobileFilterPanel title="Category" @back="pop">
                    <ion-list class="mobile-category-list" lines="full">
                      <ion-item
                        button
                        :detail="false"
                        :class="{ 'mobile-category-list__item--selected': !selectedCategory }"
                        @click="selectCategory('', popAll)"
                      >
                        <ion-label>All categories</ion-label>
                      </ion-item>
                      <ion-item
                        v-for="category in categories"
                        :key="category.id"
                        button
                        :detail="false"
                        :class="{ 'mobile-category-list__item--selected': selectedCategory === category.id }"
                        @click="selectCategory(category.id, popAll)"
                      >
                        <ion-label>{{ category.name }}</ion-label>
                      </ion-item>
                    </ion-list>
                  </MobileFilterPanel>
                </template>
              </MobileFilterDrawer>

              <template v-else>
                <div class="sidebar-section">
                  <h2 class="sidebar-heading">Category</h2>
                  <ion-select
                    v-model="selectedCategory"
                    interface="popover"
                    placeholder="All categories"
                    class="sidebar-select category-select"
                    @ionChange="onCategoryChange"
                  >
                    <ion-select-option value="">All categories</ion-select-option>
                    <ion-select-option
                      v-for="category in categories"
                      :key="category.id"
                      :value="category.id"
                    >
                      {{ category.name }}
                    </ion-select-option>
                  </ion-select>
                </div>

                <div class="sidebar-section">
                  <h2 class="sidebar-heading">Distance</h2>
                  <BrowseGeoFilter v-model="geoFilter" @apply="onGeoFilterApply" />
                </div>
              </template>
            </aside>
          </Teleport>

          <div class="browse-main">
        <GuestBrowsePromo v-if="showGuestPromo" />

        <div v-if="showTopSellButton" class="community-actions">
          <ion-button expand="block" :router-link="sellLink">
            Sell on {{ selectedCommunityName }}
          </ion-button>
        </div>

        <div v-if="error" class="empty-state">
          <p>{{ error }}</p>
          <ion-button fill="outline" @click="reloadListings">Try again</ion-button>
        </div>

        <ion-list v-else-if="showSkeletons">
          <ListingRowSkeleton />
        </ion-list>

        <div v-else-if="showNoListings" class="empty-state">
          <p>{{ noListingsMessage }}</p>
          <ion-note>{{ noListingsHint }}</ion-note>
        </div>

        <ion-list v-else>
          <ion-item
            v-for="listing in visibleItems"
            :key="listing.id"
            button
            :router-link="`/listing/${listing.id}`"
            detail
          >
            <ion-thumbnail slot="start">
              <AuthenticatedImage :src="listing.imageUrl" :alt="listing.title" />
            </ion-thumbnail>
            <ion-label>
              <h2>{{ listing.title }}</h2>
              <p>{{ formatPrice(listing.price) }} · {{ listing.sellerName }}</p>
              <p class="community-tags">
                {{ categoryLabel(listing) }} · {{ communityLabel(listing.communityIds) }}
              </p>
            </ion-label>
          </ion-item>

          <ListingRowSkeleton
            v-for="index in trailingSkeletonCount"
            :key="`trailing-${index}`"
          />
        </ion-list>

        <div v-if="loadingMore" class="loading-more">
          <ion-spinner name="crescent" />
        </div>

        <div v-if="showEndOfList && !showNoListings" :class="showEmpty ? 'empty-state' : 'end-of-list'">
          <p v-if="showEmpty">You have reached the bottom of the list!</p>
          <ion-note v-else>You have reached the bottom of the list!</ion-note>
        </div>

        <div ref="bottomSentinelRef" class="bottom-sentinel" aria-hidden="true" />

        <div v-if="showBottomSellButton" class="community-actions bottom-sell">
          <ion-button expand="block" :router-link="sellLink">
            Sell on {{ selectedCommunityName }}
          </ion-button>
        </div>
          </div>
        </div>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/currency';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonThumbnail,
  IonToolbar,
} from '@ionic/vue';
import { addOutline, menuOutline } from 'ionicons/icons';
import type { DocumentSnapshot } from 'firebase/firestore';

import { getCommunityName } from '@/features/communities/services/communities';
import {
  fetchCategories,
  getCategoryName,
  getStaleCategories,
} from '@/features/listings/services/categories';
import {
  bootstrapCommunities,
  bootstrapProfile,
  bootstrapRefreshing,
  getJoinedCommunities,
  waitForBootstrap,
} from '@/common/services/appBootstrap';
import { currentUser } from '@/features/auth/services/auth';
import { getCacheOwnerUid, getCached, getStaleCached } from '@/common/services/responseCache';
import { fetchBrowsePage } from '@/features/listings/services/listingFeed';
import {
  browseFeedCacheKey,
  getCachedBrowsePage,
  getStaleBrowsePage,
  invalidateBrowseFeedCache,
  setCachedBrowsePage,
} from '@/features/listings/services/browseFeedCache';
import {
  invalidateListingSearchCache,
  listingSearchCacheKey,
  searchListings,
  type ListingSearchResult,
} from '@/features/listings/services/listingSearch';
import BrowseGeoFilter from '@/features/listings/components/BrowseGeoFilter.vue';
import {
  defaultGeoFilterState,
  hydrateGeoFilterFromPrefs,
  type GeoFilterState,
} from '@/features/listings/services/geoFilterStorage';
import { applyBrowseFilters as applyBrowseListingFilters } from '@/features/listings/utils/browseFilters';
import {
  buildGeoFilterInputPayload,
  logGeoFilterInputChanged,
  logGeoFilterOutcome,
} from '@/features/listings/utils/geoDebugLog';
import { milesToKm } from '@/features/listings/utils/geoDistance';
import AppContentFrame from '@/components/AppContentFrame.vue';
import AppTabRefreshingIndicator from '@/components/AppTabRefreshingIndicator.vue';
import AppTopToolbar from '@/components/AppTopToolbar.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import MobileFilterDrawer from '@/components/MobileFilterDrawer.vue';
import MobileFilterNavRow from '@/components/MobileFilterNavRow.vue';
import MobileFilterPanel from '@/components/MobileFilterPanel.vue';
import ListingRowSkeleton from '@/components/skeletons/ListingRowSkeleton.vue';
import GuestBrowsePromo from '@/features/shell/components/GuestBrowsePromo.vue';
import { useLazyReveal } from '@/common/composables/useLazyReveal';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  isFirestorePermissionDenied,
  isSessionExpiredError,
  withTransientFirestoreRetry,
} from '@/common/services/firestoreAuth';
import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import type { Category, Listing } from '@/types';

function hydrateBrowsePlaceholder(communityId: string, categoryId: string) {
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  const cacheKey = browseFeedCacheKey(uid, communityId, categoryId || undefined);
  const stale = getStaleBrowsePage(cacheKey) ?? getCachedBrowsePage(cacheKey);
  if (stale?.listings.length) {
    debugLog.debug('browse', 'Cache hit — hydrating placeholder', {
      cacheKey,
      count: stale.listings.length,
    });
    return {
      cacheKey,
      listings: stale.listings,
      lastDoc: stale.lastDoc,
      hasMore: stale.hasMore,
      hasPlaceholder: true,
    };
  }

  debugLog.debug('browse', 'Cache miss', { cacheKey });
  return {
    cacheKey,
    listings: [] as Listing[],
    lastDoc: null as DocumentSnapshot | null,
    hasMore: false,
    hasPlaceholder: false,
  };
}

const initialBrowse = hydrateBrowsePlaceholder(ALL_COMMUNITY_ID, '');

const initialGeoFilter = hydrateGeoFilterFromPrefs(
  currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous',
  defaultGeoFilterState(),
);

const listings = ref<Listing[]>(initialBrowse.listings);
const categories = ref<Category[]>([]);
const selectedCommunity = ref(ALL_COMMUNITY_ID);
const selectedCategory = ref('');
const searchQuery = ref('');
const geoFilter = ref<GeoFilterState & { locating?: boolean }>(initialGeoFilter);
const loading = ref(!initialBrowse.hasPlaceholder);
const refreshing = ref(false);
const loadingMore = ref(false);
const error = ref('');
const hasMore = ref(initialBrowse.hasMore);
const searchPage = ref(1);
const lastFeedDoc = ref<DocumentSnapshot | null>(initialBrowse.lastDoc);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
const bottomSentinelRef = ref<HTMLElement | null>(null);
const isScrollable = ref(false);
const atBottom = ref(false);

const MOBILE_SIDEBAR_QUERY = '(max-width: 767.98px)';

function readMobileSidebarMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia(MOBILE_SIDEBAR_QUERY).matches;
}

const sidebarOpen = ref(false);
const isMobileSidebar = ref(readMobileSidebarMode());
const mobileChromeBottom = ref(0);
const filterPanelStack = ref<string[]>([]);

const mobileOverlayStyle = computed(() => ({
  top: `${mobileChromeBottom.value}px`,
  height: `calc(100% - ${mobileChromeBottom.value}px)`,
}));

let mobileSidebarMediaQuery: MediaQueryList | undefined;

const browseCommunities = computed(() => getJoinedCommunities(bootstrapProfile.value));

const selectedCommunityName = computed(
  () => getCommunityName(bootstrapCommunities.value, selectedCommunity.value) ?? 'All',
);

const selectedCategoryLabel = computed(() => {
  if (!selectedCategory.value) {
    return 'All categories';
  }
  return getCategoryName(categories.value, selectedCategory.value);
});

const sellLink = computed(() => ({
  path: '/tabs/sell',
  query: { community: selectedCommunity.value },
}));

const isTextSearchMode = computed(() => searchQuery.value.trim().length > 0);

const isGeoFilterActive = computed(
  () =>
    geoFilter.value.enabled &&
    geoFilter.value.lat != null &&
    geoFilter.value.lng != null,
);

/** Text-only search uses the API; geo distance always filters the community feed locally. */
const isApiSearchMode = computed(
  () => isTextSearchMode.value && !isGeoFilterActive.value,
);

function currentBrowseCacheKey(): string {
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  return browseFeedCacheKey(uid, selectedCommunity.value, selectedCategory.value || undefined);
}

function buildSearchParams(page = 1, forceRefresh?: boolean) {
  const params = {
    communityId: selectedCommunity.value,
    categoryId: selectedCategory.value || undefined,
    page,
    forceRefresh,
  };

  const query = searchQuery.value.trim();
  if (query) {
    Object.assign(params, { q: query });
  }

  if (isGeoFilterActive.value) {
    Object.assign(params, {
      lat: geoFilter.value.lat!,
      lng: geoFilter.value.lng!,
      radiusKm: milesToKm(geoFilter.value.radiusMiles),
    });
  }

  return params;
}

function currentSearchCacheKey(page = 1) {
  return listingSearchCacheKey(buildSearchParams(page));
}

function applyBrowseFilters(listingsToFilter: Listing[], logSource?: 'local-feed' | 'cache-stale'): Listing[] {
  const filtered = applyBrowseListingFilters(listingsToFilter, {
    query: searchQuery.value,
    geo: isGeoFilterActive.value
      ? {
          lat: geoFilter.value.lat!,
          lng: geoFilter.value.lng!,
          radiusKm: milesToKm(geoFilter.value.radiusMiles),
        }
      : null,
  });

  if (isGeoFilterActive.value && logSource) {
    logGeoFilterOutcome(
      listingsToFilter,
      filtered,
      {
        enabled: true,
        lat: geoFilter.value.lat!,
        lng: geoFilter.value.lng!,
        radiusMiles: geoFilter.value.radiusMiles,
        centerLabel: geoFilter.value.label || 'your location',
        query: searchQuery.value.trim() || undefined,
        communityId: selectedCommunity.value,
        categoryId: selectedCategory.value || null,
      },
      logSource,
    );
  }

  return filtered;
}

const {
  visibleItems,
  showSkeletons,
  trailingSkeletonCount,
  showEmpty,
  onScroll: onLazyScroll,
} = useLazyReveal(listings, { contentRef, loading });

const showEndOfList = computed(
  () =>
    !error.value &&
    !loading.value &&
    !showSkeletons.value &&
    !loadingMore.value &&
    !hasMore.value &&
    visibleItems.value.length >= listings.value.length &&
    isScrollable.value,
);

const showGuestPromo = computed(() => !currentUser.value && isMobileSidebar.value);

const showTopSellButton = computed(
  () =>
    Boolean(currentUser.value) &&
    !error.value &&
    (loading.value || showSkeletons.value || !isScrollable.value),
);
const showBottomSellButton = computed(
  () =>
    Boolean(currentUser.value) &&
    !loading.value &&
    !error.value &&
    !showSkeletons.value &&
    isScrollable.value &&
    atBottom.value,
);

const showNoListings = computed(
  () =>
    !error.value &&
    !loading.value &&
    !showSkeletons.value &&
    !loadingMore.value &&
    listings.value.length === 0,
);

const noListingsMessage = computed(() => {
  if (isGeoFilterActive.value) {
    const center = geoFilter.value.label || 'your location';
    return `No listings within ${geoFilter.value.radiusMiles} mi of ${center}.`;
  }

  return `No listings yet in ${selectedCommunityName.value}.`;
});

const noListingsHint = computed(() =>
  isGeoFilterActive.value
    ? 'Try increasing the radius or choosing a different location.'
    : 'Be the first to list something for sale.',
);

const showUpdatingIndicator = computed(
  () => refreshing.value || bootstrapRefreshing.value,
);

let bottomObserver: IntersectionObserver | undefined;
let loadMoreLock = false;

async function loadInitialListings() {
  const cacheKey = currentBrowseCacheKey();

  error.value = '';
  searchPage.value = 1;

  if (!isApiSearchMode.value) {
    const stale = getStaleBrowsePage(cacheKey) ?? getCachedBrowsePage(cacheKey);
    if (stale?.listings.length) {
      listings.value = applyBrowseFilters(stale.listings, 'cache-stale');
      lastFeedDoc.value = stale.lastDoc;
      hasMore.value = stale.hasMore;
      loading.value = false;
      debugLog.debug('browse', 'Cache hit — showing stale placeholder', {
        cacheKey,
        count: stale.listings.length,
      });
    } else {
      debugLog.debug('browse', 'Cache miss — showing skeleton', { cacheKey });
      loading.value = true;
      listings.value = [];
      lastFeedDoc.value = null;
      hasMore.value = false;
    }
  } else {
    const searchKey = currentSearchCacheKey(1);
    const stale =
      getStaleCached<ListingSearchResult>(searchKey) ??
      getCached<ListingSearchResult>(searchKey);
    if (stale?.listings.length) {
      listings.value = stale.listings;
      hasMore.value = stale.hasMore;
      searchPage.value = stale.page;
      loading.value = false;
      debugLog.debug('browse', 'Search cache hit — showing stale placeholder', {
        searchKey,
        count: stale.listings.length,
      });
    } else {
      loading.value = true;
      listings.value = [];
      hasMore.value = false;
    }
    lastFeedDoc.value = null;
  }

  const hadPlaceholder = listings.value.length > 0;
  refreshing.value = hadPlaceholder;
  let keepLoadingAfterFailure = false;

  try {
    debugLog.debug('browse', 'Fetch start', {
      cacheKey,
      communityId: selectedCommunity.value,
      categoryId: selectedCategory.value || null,
      search: searchQuery.value.trim() || null,
      hadPlaceholder,
      placeholderCount: listings.value.length,
      geo: isGeoFilterActive.value ? buildGeoFilterInputPayload(geoFilter.value) : null,
    });

    await waitForBootstrap();

    if (isApiSearchMode.value) {
      const result = await withTransientFirestoreRetry(
        () => searchListings(buildSearchParams(1, hadPlaceholder)),
        { context: 'browse-search', user: currentUser.value },
      );
      listings.value = result.listings;
      hasMore.value = result.hasMore;
      searchPage.value = 1;
      debugLog.debug('browse', 'Search fetch complete', {
        cacheKey,
        count: result.listings.length,
        hasMore: result.hasMore,
      });
    } else {
      const page = await withTransientFirestoreRetry(
        () => fetchBrowsePage(selectedCommunity.value, {
          categoryId: selectedCategory.value || undefined,
        }),
        { context: isGeoFilterActive.value ? 'browse-feed-geo' : 'browse-feed', user: currentUser.value },
      );
      const filtered = applyBrowseFilters(page.listings, 'local-feed');
      listings.value = filtered;
      lastFeedDoc.value = page.lastDoc;
      hasMore.value = isGeoFilterActive.value ? false : page.hasMore;
      setCachedBrowsePage(cacheKey, page);
      debugLog.debug(
        'browse',
        isGeoFilterActive.value ? 'Geo filter fetch complete' : 'Fetch complete',
        {
          cacheKey,
          count: filtered.length,
          feedCount: page.listings.length,
          hasMore: hasMore.value,
          geo: isGeoFilterActive.value ? buildGeoFilterInputPayload(geoFilter.value) : null,
        },
      );
    }
  } catch (err) {
    if (isSessionExpiredError(err)) {
      return;
    }

    const isTransientPermission = isFirestorePermissionDenied(err);
    const message = isTransientPermission
      ? 'Still connecting…'
      : err instanceof Error ? err.message : 'Failed to load listings';

    if (hadPlaceholder && listings.value.length > 0) {
      debugLog.warn('browse', 'Fetch failed — keeping placeholder listings', {
        cacheKey,
        communityId: selectedCommunity.value,
        placeholderCount: listings.value.length,
        error: serializeError(err),
      });
    } else if (isTransientPermission) {
      debugLog.warn('browse', 'Transient permission-denied after retries; scheduling reload', {
        cacheKey,
        communityId: selectedCommunity.value,
        error: serializeError(err),
      });
      keepLoadingAfterFailure = true;
      window.setTimeout(() => {
        reloadListings();
      }, 600);
    } else {
      error.value = message;
      debugLog.warn('browse', 'loadInitialListings failed', {
        cacheKey,
        communityId: selectedCommunity.value,
        categoryId: selectedCategory.value || null,
        search: searchQuery.value.trim() || null,
        error: serializeError(err),
      });
    }
  } finally {
    if (!keepLoadingAfterFailure) {
      loading.value = false;
    }
    refreshing.value = false;
    await nextTick(() => {
      void updateScrollState();
    });
  }
}

function invalidateCurrentListingCache() {
  if (isApiSearchMode.value) {
    invalidateListingSearchCache(currentSearchCacheKey(1));
    return;
  }

  invalidateBrowseFeedCache(currentBrowseCacheKey());
}

async function loadMoreListings() {
  if (!hasMore.value || loadingMore.value || loading.value || loadMoreLock) {
    return;
  }

  loadMoreLock = true;
  loadingMore.value = true;

  try {
    if (isApiSearchMode.value) {
      const nextPage = searchPage.value + 1;
      const result = await searchListings(buildSearchParams(nextPage, true));
      listings.value = [...listings.value, ...result.listings];
      hasMore.value = result.hasMore;
      searchPage.value = nextPage;
      invalidateCurrentListingCache();
    } else if (lastFeedDoc.value) {
      const page = await fetchBrowsePage(selectedCommunity.value, {
        categoryId: selectedCategory.value || undefined,
        startAfterDoc: lastFeedDoc.value,
      });
      listings.value = [...listings.value, ...page.listings];
      lastFeedDoc.value = page.lastDoc;
      hasMore.value = page.hasMore;
      invalidateCurrentListingCache();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load more listings';
  } finally {
    loadingMore.value = false;
    loadMoreLock = false;
  }
}

function reloadListings() {
  void loadInitialListings();
}

function onCategoryChange() {
  reloadListings();
  closeSidebar();
}

function selectCategory(categoryId: string, popAll: () => void) {
  selectedCategory.value = categoryId;
  popAll();
  reloadListings();
  closeSidebar();
}

function onGeoFilterApply() {
  if (geoFilter.value.enabled && geoFilter.value.lat == null) {
    return;
  }

  logGeoFilterInputChanged(geoFilter.value, 'apply', {
    communityId: selectedCommunity.value,
    categoryId: selectedCategory.value || null,
    search: searchQuery.value.trim() || null,
  });
  reloadListings();
}

function toggleSidebar() {
  if (sidebarOpen.value) {
    closeSidebar();
  } else {
    sidebarOpen.value = true;
  }
}

function closeSidebar() {
  sidebarOpen.value = false;
  filterPanelStack.value = [];
}

function syncMobileSidebarMode() {
  isMobileSidebar.value =
    mobileSidebarMediaQuery?.matches ?? readMobileSidebarMode();
  if (!isMobileSidebar.value) {
    sidebarOpen.value = false;
    filterPanelStack.value = [];
  }
  updateMobileChromeBottom();
}

function updateMobileChromeBottom() {
  requestAnimationFrame(() => {
    const page = document.querySelector('.browse-page');
    const header = page?.querySelector('ion-header');
    let bottom = 0;
    if (header) {
      bottom += header.getBoundingClientRect().height;
    }
    mobileChromeBottom.value = bottom;
  });
}

function onSearchInput() {
  reloadListings();
}

function sellActionsHeight(scrollEl: HTMLElement): number {
  return Array.from(scrollEl.querySelectorAll('.community-actions')).reduce(
    (total, element) => total + element.getBoundingClientRect().height,
    0,
  );
}

async function updateScrollState() {
  const ionContent = contentRef.value;
  if (!ionContent?.$el) {
    return;
  }

  const scrollEl = await ionContent.$el.getScrollElement();
  const contentScrollHeight = scrollEl.scrollHeight - sellActionsHeight(scrollEl);
  isScrollable.value = contentScrollHeight - scrollEl.clientHeight > 8;
  atBottom.value =
    scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 16;

  setupBottomObserver();
}

function setupBottomObserver() {
  bottomObserver?.disconnect();
  bottomObserver = undefined;

  if (!bottomSentinelRef.value) {
    return;
  }

  bottomObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      atBottom.value = visible;
      if (visible) {
        void loadMoreListings();
      }
    },
    {
      root: null,
      threshold: 0.01,
    },
  );

  bottomObserver.observe(bottomSentinelRef.value);
}

async function handleScroll() {
  await onLazyScroll();

  if (!isScrollable.value) {
    return;
  }

  const ionContent = contentRef.value;
  if (!ionContent?.$el) {
    return;
  }

  const scrollEl = await ionContent.$el.getScrollElement();
  atBottom.value =
    scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 16;
}

watch(sidebarOpen, (open) => {
  if (!isMobileSidebar.value) {
    return;
  }
  document.body.classList.toggle('browse-sidebar-open', open);
});

onMounted(() => {
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  geoFilter.value = hydrateGeoFilterFromPrefs(uid, geoFilter.value);
  mobileSidebarMediaQuery = window.matchMedia(MOBILE_SIDEBAR_QUERY);
  syncMobileSidebarMode();
  mobileSidebarMediaQuery.addEventListener('change', syncMobileSidebarMode);

  const staleCategories = getStaleCategories();
  if (staleCategories) {
    categories.value = staleCategories;
  }

  void fetchCategories()
    .then((fresh) => {
      categories.value = fresh;
    })
    .catch((err) => {
      debugLog.warn('browse', 'Categories fetch failed', {
        error: serializeError(err),
      });
    });

  void loadInitialListings().catch((err) => {
    const message = err instanceof Error ? err.message : 'Failed to load listings';
    error.value = message;
    loading.value = false;
    debugLog.warn('browse', 'HomePage mount failed', {
      error: serializeError(err),
    });
  });

  window.addEventListener('resize', handleResize);
  void nextTick(() => {
    updateMobileChromeBottom();
  });
});

function handleResize() {
  syncMobileSidebarMode();
  void updateScrollState();
}

watch(browseCommunities, (communities) => {
  if (!communities.some((community) => community.id === selectedCommunity.value)) {
    selectedCommunity.value = ALL_COMMUNITY_ID;
  }
});

watch(selectedCommunity, () => {
  reloadListings();
});

watch([showSkeletons, () => visibleItems.value.length, () => listings.value.length], () => {
  void nextTick(() => {
    void updateScrollState();
  });
});

onUnmounted(() => {
  bottomObserver?.disconnect();
  window.removeEventListener('resize', handleResize);
  mobileSidebarMediaQuery?.removeEventListener('change', syncMobileSidebarMode);
  document.body.classList.remove('browse-sidebar-open');
});

function onCommunityChange(event: CustomEvent) {
  selectedCommunity.value = event.detail.value;
}

function categoryLabel(listing: Listing): string {
  return getCategoryName(categories.value, listing.primaryCategoryId);
}

function communityLabel(communityIds: string[]): string {
  const names = communityIds
    .map((id) => getCommunityName(bootstrapCommunities.value, id))
    .filter(Boolean);
  return names.join(', ');
}
</script>

<style scoped>
.browse-layout {
  display: flex;
  align-items: stretch;
  min-height: 100%;
}

.browse-sidebar {
  flex-shrink: 0;
  width: 10.5rem;
  padding: 0.75rem 0.65rem;
  border-right: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  background: var(--ion-background-color, #121212);
}

.sidebar-section + .sidebar-section {
  margin-top: 1.25rem;
}

.sidebar-heading {
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.sidebar-select {
  width: 100%;
  max-width: 100%;
  --padding-start: 0;
  --padding-end: 0;
  font-size: 0.92rem;
}

.mobile-category-list {
  margin: 0 -0.65rem;
  padding: 0;
  background: transparent;
}

.mobile-category-list ion-item {
  --padding-start: 0.65rem;
  --inner-padding-end: 0.65rem;
  font-size: 0.92rem;
}

.mobile-category-list__item--selected {
  --background: rgba(var(--ion-color-primary-rgb, 56, 128, 255), 0.12);
  font-weight: 600;
}

.browse-main {
  flex: 1;
  min-width: 0;
}

.community-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.search-filter-row {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.search-filter-row__search {
  flex: 1;
  min-width: 0;
  padding: 0;
}

.community-segment {
  flex: 1;
  min-width: 0;
}

.add-community-btn {
  flex-shrink: 0;
  margin: 0;
  --padding-start: 0.5rem;
  --padding-end: 0.5rem;
  font-size: 1.5rem;
}

.community-actions {
  padding: 0.75rem 0;
}

.bottom-sell {
  padding-bottom: 1rem;
}

.bottom-sentinel {
  height: 1px;
}

.loading-more {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.end-of-list {
  display: flex;
  justify-content: center;
  padding: 1.5rem 1rem;
  text-align: center;
}

.community-tags {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.mobile-filter-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin: 0;
  padding: 0.45rem;
  border: none;
  background: transparent;
  color: var(--ion-text-color, #fff);
  font-size: 1.45rem;
  line-height: 1;
  cursor: pointer;
}

.mobile-filter-toggle:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.85);
  outline-offset: 2px;
}

@media (max-width: 767.98px) {
  .mobile-filter-toggle {
    display: inline-flex;
  }

  .browse-sidebar {
    position: fixed;
    left: 0;
    width: 85vw;
    max-width: 85vw;
    z-index: 10001;
    transform: translateX(-100%);
    transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    border-right: none;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.35);
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .browse-sidebar--open {
    transform: translateX(0);
    pointer-events: auto;
  }
}

@media (min-width: 768px) {
  .browse-sidebar {
    width: 12.5rem;
    padding: 1rem 0.85rem;
  }
}
</style>

<style>
body.browse-sidebar-open {
  overflow: hidden;
}

.browse-sidebar-backdrop {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.45);
}
</style>
