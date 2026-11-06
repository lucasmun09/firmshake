<template>
  <ion-page class="browse-page">
    <AppTopToolbar title="Browse">
      <AppTabRefreshingIndicator :active="showUpdatingIndicator" />
      <ion-toolbar class="app-toolbar-content">
        <AppContentFrame class="app-content-frame--flush-y">
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
              router-link="/tabs/communities/create"
            >
              <ion-icon slot="icon-only" :icon="addOutline" />
            </ion-button>
          </div>

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
              v-model="draftSearchQuery"
              class="search-filter-row__search"
              placeholder="Search listings"
              :debounce="0"
              enterkeyhint="search"
              data-testid="browse-searchbar"
              @keydown.enter.prevent="flushBrowseSearch"
            />
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

    <ion-content ref="contentRef" class="app-tab-content" @ionScroll="handleScroll">
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
                    <h2 class="sidebar-heading">View</h2>
                    <BrowseViewSelector v-model="viewMode" :show-map="bffBrowseEnabled" />
                  </div>

                  <div class="sidebar-section">
                    <h2 class="sidebar-heading">Distance</h2>
                    <BrowseGeoFilter
                      v-model="draftGeoFilter"
                      @apply="onGeoFilterApply"
                    />
                  </div>

                  <div class="sidebar-section">
                    <h2 class="sidebar-heading">Category</h2>
                    <MobileFilterNavRow
                      :value="draftCategoryLabel"
                      aria-label="Choose category"
                      @click="push('category')"
                    />
                  </div>

                  <div class="sidebar-section">
                    <h2 class="sidebar-heading">Price</h2>
                    <div class="price-filter-row">
                      <ion-input
                        v-model="draftPriceMin"
                        type="number"
                        inputmode="decimal"
                        placeholder="Min"
                        aria-label="Minimum price"
                      />
                      <span class="price-filter-sep">–</span>
                      <ion-input
                        v-model="draftPriceMax"
                        type="number"
                        inputmode="decimal"
                        placeholder="Max"
                        aria-label="Maximum price"
                      />
                    </div>
                  </div>

                  <div class="sidebar-section">
                    <h2 class="sidebar-heading">Sort</h2>
                    <ion-select
                      v-model="draftSort"
                      :interface="selectInterface"
                      class="sidebar-select"
                      aria-label="Sort listings"
                    >
                      <ion-select-option value="newest">Newest</ion-select-option>
                      <ion-select-option value="price_asc">Price: low to high</ion-select-option>
                      <ion-select-option value="price_desc">Price: high to low</ion-select-option>
                      <ion-select-option
                        v-if="draftGeoFilter.lat != null"
                        value="distance"
                      >
                        Distance
                      </ion-select-option>
                    </ion-select>
                  </div>

                  <ion-button expand="block" class="apply-filters-btn" @click="applyFiltersAndClose">
                    Apply filters
                  </ion-button>
                </template>

                <template #panel-category="{ pop, popAll }">
                  <MobileFilterPanel title="Category" @back="pop">
                    <ion-list class="mobile-category-list" lines="full">
                      <ion-item
                        button
                        :detail="false"
                        :class="{ 'mobile-category-list__item--selected': !draftCategory }"
                        @click="selectDraftCategory('', popAll)"
                      >
                        <ion-label>All categories</ion-label>
                      </ion-item>
                      <ion-item
                        v-for="category in categories"
                        :key="category.id"
                        button
                        :detail="false"
                        :class="{ 'mobile-category-list__item--selected': draftCategory === category.id }"
                        @click="selectDraftCategory(category.id, popAll)"
                      >
                        <ion-label>{{ category.name }}</ion-label>
                      </ion-item>
                    </ion-list>
                  </MobileFilterPanel>
                </template>
              </MobileFilterDrawer>

              <template v-else>
                <div class="sidebar-section">
                  <h2 class="sidebar-heading">View</h2>
                  <BrowseViewSelector v-model="viewMode" :show-map="bffBrowseEnabled" />
                </div>

                <div class="sidebar-section">
                  <h2 class="sidebar-heading">Distance</h2>
                  <BrowseGeoFilter
                    v-model="draftGeoFilter"
                    @apply="onGeoFilterApply"
                  />
                </div>

                <div class="sidebar-section">
                  <h2 class="sidebar-heading">Category</h2>
                  <ion-select
                    v-model="draftCategory"
                    :interface="selectInterface"
                    placeholder="All categories"
                    class="sidebar-select category-select"
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
                  <h2 class="sidebar-heading">Price</h2>
                  <div class="price-filter-row">
                    <ion-input
                      v-model="draftPriceMin"
                      type="number"
                      inputmode="decimal"
                      placeholder="Min"
                      aria-label="Minimum price"
                    />
                    <span class="price-filter-sep">–</span>
                    <ion-input
                      v-model="draftPriceMax"
                      type="number"
                      inputmode="decimal"
                      placeholder="Max"
                      aria-label="Maximum price"
                    />
                  </div>
                </div>

                <div class="sidebar-section">
                  <h2 class="sidebar-heading">Sort</h2>
                  <ion-select
                    v-model="draftSort"
                    :interface="selectInterface"
                    class="sidebar-select"
                    aria-label="Sort listings"
                  >
                    <ion-select-option value="newest">Newest</ion-select-option>
                    <ion-select-option value="price_asc">Price: low to high</ion-select-option>
                    <ion-select-option value="price_desc">Price: high to low</ion-select-option>
                    <ion-select-option
                      v-if="draftGeoFilter.lat != null"
                      value="distance"
                    >
                      Distance
                    </ion-select-option>
                  </ion-select>
                </div>

                <ion-button
                  expand="block"
                  class="apply-filters-btn"
                  :disabled="!hasPendingFilterChanges && !loading"
                  @click="applyFilters"
                >
                  Apply filters
                </ion-button>
              </template>
            </aside>
          </Teleport>

        <div ref="browseMainRef" class="browse-main">
        <GuestBrowsePromo v-if="showGuestPromo" />

        <BrowseRecentCarousel :visible-slot-count="recentCarouselSlotCount" />

        <div v-if="showTopSellButton" class="community-actions">
          <ion-button expand="block" :router-link="sellLink">
            Sell on {{ selectedCommunityName }}
          </ion-button>
        </div>

        <div v-if="error" class="empty-state">
          <p>{{ error }}</p>
          <ion-button fill="outline" @click="reloadListings">Try again</ion-button>
        </div>

        <BrowseMapView
          v-else-if="effectiveViewMode === 'map'"
          v-model:address-query="mapAddressQuery"
          :listings="mapListings"
          :server-pin-groups="mapPinGroups"
          :center="mapCenter"
          :center-radius-miles="mapCenterRadiusMiles"
          :loading="mapLoading"
          :community-loading="communityMapLoading"
          @bounds-change="onMapBoundsChange"
          @geo-search="onMapGeoSearch"
          @listing-unavailable="onMapListingUnavailable"
        />

        <div
          v-else-if="showResultsLoading"
          class="results-loading"
          aria-busy="true"
          aria-live="polite"
        >
          <ion-spinner name="circular" />
        </div>

        <div v-else-if="showNoListings" class="empty-state" data-testid="browse-empty-state">
          <p>{{ browseEmptyState.message }}</p>
          <ion-note>{{ browseEmptyState.hint }}</ion-note>
          <ion-button
            v-if="browseEmptyState.showClearFilters"
            fill="outline"
            class="browse-empty-clear"
            data-testid="browse-clear-filters"
            @click="clearBrowseFilters"
          >
            Clear filters
          </ion-button>
        </div>

        <div v-else-if="effectiveViewMode === 'cards'" class="browse-cards-wrap">
          <BrowseCardsView
            :listings="visibleItems"
            :trailing-skeleton-count="combinedTrailingSkeletonCount"
          />
        </div>

        <ion-list v-else-if="effectiveViewMode === 'list'">
          <ion-item
            v-for="listing in visibleItems"
            :key="listing.id"
            button
            :router-link="`/listing/${listing.id}`"
            detail
          >
            <ion-thumbnail slot="start">
              <AuthenticatedImage
                :src="listing.imageUrl"
                :alt="listing.title"
                variant="thumbnail"
              />
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
            v-for="index in combinedTrailingSkeletonCount"
            :key="`trailing-${index}`"
          />
        </ion-list>

        <div v-if="loadingMoreVisible && effectiveViewMode !== 'map'" class="loading-more">
          <ion-spinner name="crescent" />
        </div>

        <div
          v-if="showEndOfList && !showNoListings && effectiveViewMode !== 'map'"
          :class="showEmpty ? 'empty-state' : 'end-of-list'"
        >
          <ion-note>You have reached the bottom of the list!</ion-note>
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
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
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
  onIonViewWillLeave,
} from '@ionic/vue';
import { addOutline, menuOutline } from 'ionicons/icons';
import type { DocumentSnapshot } from 'firebase/firestore';

import { useBffBrowse } from '@/common/config/featureFlags';
import { getCommunityName } from '@/features/communities/services/communities';
import {
  fetchCategories,
  getCategoryName,
  getStaleCategories,
} from '@/features/listings/services/categoriesRouter';
import {
  loadPersistedBrowseCommunity,
  persistBrowseCommunity,
} from '@/features/listings/services/browseCommunityStorage';
import {
  loadPersistedBrowseViewMode,
  persistBrowseViewMode,
} from '@/features/listings/services/browseViewModeStorage';
import {
  buildBrowseLocalAllKey,
  buildBrowseLocalFilterKeyParams,
  buildBrowseLocalMapKey,
  getStaleBrowseLocalCache,
  listingsFromCachePayload,
  mergeFreshBrowseResultsOnTop,
  persistBrowseLocalPool,
  resolveBrowseLocalCacheKey,
} from '@/features/listings/services/browseLocalStorageCache';
import {
  browseSearchCacheKey,
  invalidateBrowseSearchCache,
  searchBrowseListings,
  type BrowseSort,
} from '@/features/listings/services/browseSearch';
import {
  bootstrapCommunities,
  bootstrapProfile,
  bootstrapRefreshing,
  getJoinedCommunities,
  waitForBootstrap,
} from '@/common/services/appBootstrap';
import { currentUser } from '@/features/auth/services/auth';
import { getCacheOwnerUid, getCached, getStaleCached } from '@/common/services/responseCache';
import { fetchBrowsePage, getCommunityFeedDocSnapshot } from '@/features/listings/services/listingFeed';
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
import BrowseCardsView from '@/features/listings/components/BrowseCardsView.vue';
import BrowseGeoFilter from '@/features/listings/components/BrowseGeoFilter.vue';
import BrowseMapView from '@/features/listings/components/BrowseMapView.vue';
import BrowseRecentCarousel from '@/features/listings/components/BrowseRecentCarousel.vue';
import BrowseViewSelector from '@/features/listings/components/BrowseViewSelector.vue';
import {
  normalizeBrowseViewMode,
  type BrowseViewMode,
} from '@/features/listings/types/browseViewMode';
import {
  BROWSE_MAP_MAX_PREFETCH_PAGES,
  BROWSE_MAP_SEARCH_PAGE_SIZE,
  resolveMapSearchViewport,
  type MapViewportSearch,
  viewportFromCenterRadius,
  type MapGeoSearchPayload,
} from '@/features/listings/utils/browseMapView';
import type { BrowseMapPinGroup } from '@/features/listings/utils/browseMapPinAggregation';
import {
  clearGeoFilterPrefsIfUserChanged,
  defaultGeoFilterState,
  hydrateGeoFilterFromPrefs,
  saveGeoFilterPrefs,
  type GeoFilterState,
} from '@/features/listings/services/geoFilterStorage';
import { scheduleBrowseListingImagePrefetch } from '@/features/listings/utils/browseListingImagePrefetch';
import { applyBrowseFilters as applyBrowseListingFilters } from '@/features/listings/utils/browseFilters';
import { resolveBrowseEmptyState } from '@/features/listings/utils/browseEmptyState';
import {
  appendUniqueBrowseListings,
  filterLoadedBrowseListings,
  type BrowseLocalFilterParams,
} from '@/features/listings/utils/browseLocalSearch';
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
import { useIonSelectInterface } from '@/common/composables/useIonSelectInterface';
import { useLazyReveal } from '@/common/composables/useLazyReveal';
import { useMinimumDisplayVisibility } from '@/common/composables/useDebouncedVisibility';
import {
  appendBrowseListings,
  combinedTrailingSkeletonCount as computeCombinedTrailingSkeletonCount,
  feedPendingSkeletonCount as computeFeedPendingSkeletonCount,
  isLoadMoreBlocked,
  resolveBffBrowseHasMore,
  resolveCachedBrowseHasMore,
  resolveFirestoreFeedHasMore,
  shouldShowBrowseEndOfList as computeShouldShowBrowseEndOfList,
} from '@/features/listings/utils/browsePaginationUi';
import {
  applyBrowseSearchPageResult,
  BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  BROWSE_TEXT_SEARCH_PAGE_SIZE,
  browseSearchInitialPrefetchTarget,
  browseSearchPagesToMaintainBuffer,
  nextBrowseSearchPagesToPrefetch,
  shouldPrefetchBrowseSearchBuffer,
  shouldShowBrowseLoadMoreSpinner,
  shouldTriggerBrowseFeedPrefetch,
} from '@/features/listings/utils/browseSearchPrefetch';
import { BROWSE_CARDS_REVEAL_PREFETCH_THRESHOLD, BROWSE_SEARCH_DEBOUNCE_MS } from '@/features/listings/utils/browsePaginationConfig';
import { canSilentlyPrefetchBrowseSearchPage } from '@/features/listings/utils/browsePrefetchGuards';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  isFirestorePermissionDenied,
  isSessionExpiredError,
  withTransientFirestoreRetry,
} from '@/common/services/firestoreAuth';
import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import type { Category, Listing } from '@/types';
import {
  getBrowseFeedPageSize,
  getBrowseGridCellHeightPx,
  getBrowseGridColumnCount,
  getBrowseGridLayout,
  getBrowseGridRowCount,
  getBrowseGridRowHeightPx,
} from '@/features/listings/utils/browseGridLayout';
import { getRecentCarouselSlotCount } from '@/features/listings/utils/recentCarouselLayout';
import { LISTINGS_PAGE_SIZE } from '@/features/listings/utils/listingMapper';

function hydrateBrowsePlaceholder(communityId: string, categoryId: string) {
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  const localKey = buildBrowseLocalAllKey(uid, {
    communityId,
    categoryId: categoryId || undefined,
  });
  const localStale = getStaleBrowseLocalCache(localKey);
  if (localStale?.orderedIds.length) {
    const localListings = listingsFromCachePayload(localStale);
    debugLog.debug('browse', 'LocalStorage hit — hydrating placeholder', {
      cacheKey: localKey,
      count: localListings.length,
    });
    return {
      cacheKey: localKey,
      listings: localListings,
      lastDoc: null as DocumentSnapshot | null,
      hasMore: resolveCachedBrowseHasMore(localStale.hasMore, localListings.length),
      hasPlaceholder: true,
    };
  }

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
      hasMore: resolveCachedBrowseHasMore(stale.hasMore, stale.listings.length),
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

const initialGeoFilter = defaultGeoFilterState();

const bffBrowseEnabled = useBffBrowse();

const listings = ref<Listing[]>(initialBrowse.listings);
const browseLoadedPool = ref<Listing[]>(initialBrowse.listings);
scheduleBrowseListingImagePrefetch(initialBrowse.listings);

watch(browseLoadedPool, (pool) => {
  scheduleBrowseListingImagePrefetch(pool);
});
const mapListings = ref<Listing[]>([]);
const mapListingsPool = ref<Listing[]>([]);
const mapPinGroups = ref<BrowseMapPinGroup[] | null>(null);
const mapLoading = ref(false);
const communityMapLoading = ref(false);
const mapBounds = ref<MapViewportSearch | null>(null);
const categories = ref<Category[]>([]);
const selectedCommunity = ref(loadPersistedBrowseCommunity());
const draftSearchQuery = ref('');
const draftCategory = ref('');
const draftGeoFilter = ref<GeoFilterState & { locating?: boolean }>(initialGeoFilter);
const mapAddressQuery = computed({
  get: () => draftGeoFilter.value.label,
  set: (value: string) => {
    draftGeoFilter.value = {
      ...draftGeoFilter.value,
      label: value,
    };
  },
});
const draftPriceMin = ref('');
const draftPriceMax = ref('');
const draftSort = ref<BrowseSort>('newest');
const appliedSearchQuery = ref('');
const appliedCategory = ref('');
const appliedGeoFilter = ref<GeoFilterState & { locating?: boolean }>({ ...initialGeoFilter });
const appliedPriceMin = ref<number | null>(null);
const appliedPriceMax = ref<number | null>(null);
const appliedSort = ref<BrowseSort>('newest');
const viewMode = ref<BrowseViewMode>(loadPersistedBrowseViewMode(bffBrowseEnabled));

const effectiveViewMode = computed(() =>
  normalizeBrowseViewMode(viewMode.value, bffBrowseEnabled),
);
const loading = ref(!initialBrowse.hasPlaceholder);
const initialLoadPending = ref(!initialBrowse.hasPlaceholder);
const filterApplying = ref(false);
const refreshing = ref(false);
const loadingMore = ref(false);
const loadingMoreVisible = useMinimumDisplayVisibility(loadingMore);
const error = ref('');
const hasMore = ref(initialBrowse.hasMore);
const searchPage = ref(1);
// Firestore DocumentSnapshots must not be deeply reactive — Proxy breaks IDB persistence on startAfter.
const lastFeedDoc = shallowRef<DocumentSnapshot | null>(initialBrowse.lastDoc);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
const browseMainRef = ref<HTMLElement | null>(null);
const bottomSentinelRef = ref<HTMLElement | null>(null);
const gridColumnCount = ref(1);
const gridRowCount = ref(3);
const gridRowHeightPx = ref(200);
const isScrollable = ref(false);
const atBottom = ref(false);

const cardsGridColumnCount = computed(() =>
  effectiveViewMode.value === 'cards' ? gridColumnCount.value : undefined,
);

const recentCarouselSlotCount = computed(() =>
  getRecentCarouselSlotCount(
    effectiveViewMode.value,
    gridColumnCount.value,
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  ),
);

const browseFeedPageSize = computed(() =>
  effectiveViewMode.value === 'cards'
    ? getBrowseFeedPageSize(gridColumnCount.value, gridRowCount.value)
    : LISTINGS_PAGE_SIZE,
);

async function updateBrowseGridLayout() {
  const containerWidth = browseMainRef.value?.clientWidth ?? window.innerWidth;
  const viewportWidth = window.innerWidth;
  gridColumnCount.value = getBrowseGridColumnCount(containerWidth, viewportWidth);
  gridRowHeightPx.value = getBrowseGridRowHeightPx(
    containerWidth,
    gridColumnCount.value,
    viewportWidth,
  );

  const { gapPx } = getBrowseGridLayout(viewportWidth);
  const cellHeightPx = getBrowseGridCellHeightPx(
    containerWidth,
    gridColumnCount.value,
    viewportWidth,
  );

  let availableHeight = window.innerHeight * 0.55;
  const ionContent = contentRef.value;
  if (ionContent?.$el) {
    try {
      const scrollEl = await ionContent.$el.getScrollElement();
      const cardsWrap = browseMainRef.value?.querySelector('.browse-cards-wrap');
      if (cardsWrap) {
        const scrollBottom = scrollEl.getBoundingClientRect().bottom;
        const cardsTop = cardsWrap.getBoundingClientRect().top;
        availableHeight = Math.max(cellHeightPx, scrollBottom - cardsTop);
      } else {
        availableHeight = scrollEl.clientHeight;
      }
    } catch {
      // Keep fallback height when scroll host is unavailable.
    }
  }

  gridRowCount.value = getBrowseGridRowCount(availableHeight, cellHeightPx, gapPx);
}

let browseGridResizeObserver: ResizeObserver | undefined;

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
const { selectInterface } = useIonSelectInterface();

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
  if (!appliedCategory.value) {
    return 'All categories';
  }
  return getCategoryName(categories.value, appliedCategory.value);
});

const draftCategoryLabel = computed(() => {
  if (!draftCategory.value) {
    return 'All categories';
  }
  return getCategoryName(categories.value, draftCategory.value);
});

const sellLink = computed(() => ({
  path: '/tabs/sell',
  query: { community: selectedCommunity.value },
}));

const isAppliedGeoActive = computed(
  () =>
    appliedGeoFilter.value.lat != null &&
    appliedGeoFilter.value.lng != null,
);

const isTextSearchMode = computed(() => appliedSearchQuery.value.trim().length > 0);

/** Legacy path: text-only search uses GET /api/listings/search; geo filters Firestore feed locally. */
const isApiSearchMode = computed(
  () => !bffBrowseEnabled && isTextSearchMode.value && !isAppliedGeoActive.value,
);

const mapCenter = computed(() => {
  if (!isAppliedGeoActive.value) {
    return null;
  }
  return {
    lat: appliedGeoFilter.value.lat!,
    lng: appliedGeoFilter.value.lng!,
  };
});

const mapCenterRadiusMiles = computed(() =>
  isAppliedGeoActive.value
    ? appliedGeoFilter.value.radiusMiles
    : draftGeoFilter.value.radiusMiles,
);

const hasPendingFilterChanges = computed(
  () =>
    draftSearchQuery.value !== appliedSearchQuery.value ||
    draftCategory.value !== appliedCategory.value ||
    draftSort.value !== appliedSort.value ||
    draftPriceMin.value !== (appliedPriceMin.value?.toString() ?? '') ||
    draftPriceMax.value !== (appliedPriceMax.value?.toString() ?? '') ||
    draftGeoFilter.value.lat !== appliedGeoFilter.value.lat ||
    draftGeoFilter.value.lng !== appliedGeoFilter.value.lng ||
    draftGeoFilter.value.radiusMiles !== appliedGeoFilter.value.radiusMiles ||
    draftGeoFilter.value.label !== appliedGeoFilter.value.label,
);

function parseOptionalPrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function syncDraftFromApplied() {
  draftSearchQuery.value = appliedSearchQuery.value;
  draftCategory.value = appliedCategory.value;
  draftGeoFilter.value = { ...appliedGeoFilter.value };
  draftPriceMin.value = appliedPriceMin.value?.toString() ?? '';
  draftPriceMax.value = appliedPriceMax.value?.toString() ?? '';
  draftSort.value = appliedSort.value;
}

function applyDraftToApplied() {
  appliedSearchQuery.value = draftSearchQuery.value;
  appliedCategory.value = draftCategory.value;
  appliedGeoFilter.value = { ...draftGeoFilter.value };
  appliedPriceMin.value = parseOptionalPrice(draftPriceMin.value);
  appliedPriceMax.value = parseOptionalPrice(draftPriceMax.value);
  appliedSort.value = draftSort.value;
  persistAppliedGeoFilter();
}

function resetBrowseLoadedPool() {
  browseLoadedPool.value = [];
  mapListingsPool.value = [];
  mapListings.value = [];
  mapPinGroups.value = null;
  mapFetchGeneration += 1;
}

function buildMapLocalCacheKey(uid: string, viewport: MapViewportSearch): string {
  return buildBrowseLocalMapKey(uid, viewport, buildAppliedLocalCacheParams());
}

/** Client-side filter for map markers (community, category, price, keyword). Geo is API-scoped via viewport. */
function applyMapListingFilters(pool: Listing[]): Listing[] {
  return filterLoadedBrowseListings(pool, {
    ...buildLocalFilterParams(appliedSearchQuery.value),
    geo: null,
  });
}

function buildLocalFilterParams(query = draftSearchQuery.value): BrowseLocalFilterParams {
  return {
    query,
    categoryId: appliedCategory.value || undefined,
    priceMin: appliedPriceMin.value,
    priceMax: appliedPriceMax.value,
    geo: isAppliedGeoActive.value
      ? {
          lat: appliedGeoFilter.value.lat!,
          lng: appliedGeoFilter.value.lng!,
          radiusKm: milesToKm(appliedGeoFilter.value.radiusMiles),
        }
      : null,
    communityId: selectedCommunity.value,
    sort: appliedSort.value,
  };
}

function applyLocalSearchPreview() {
  const draftQuery = draftSearchQuery.value.trim();
  const appliedQuery = appliedSearchQuery.value.trim();
  if (draftQuery === appliedQuery) {
    return;
  }

  if (browseLoadedPool.value.length === 0 && mapListingsPool.value.length === 0) {
    return;
  }

  const params = buildLocalFilterParams();
  listings.value = filterLoadedBrowseListings(browseLoadedPool.value, params);
  loading.value = false;

  if (mapListingsPool.value.length > 0) {
    mapListings.value = applyMapListingFilters(mapListingsPool.value);
  }
}

async function scrollBrowseToTop() {
  const ionContent = contentRef.value as { $el?: { scrollToTop?: (duration?: number) => Promise<void> } } | null;
  try {
    await ionContent?.$el?.scrollToTop?.(300);
  } catch {
    // Ignore scroll errors on missing content.
  }
}

async function applyFilters() {
  applyDraftToApplied();
  filterApplying.value = true;
  loading.value = true;
  listings.value = [];
  resetBrowseLoadedPool();
  const startedAt = Date.now();
  void scrollBrowseToTop();

  try {
    invalidateCurrentListingCache();
    await loadInitialListings({ skipStalePlaceholder: true });
  } finally {
    const remaining = Math.max(0, FILTER_APPLY_MIN_MS - (Date.now() - startedAt));
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    filterApplying.value = false;
  }
}

function applyFiltersAndClose() {
  void applyFilters().then(() => closeSidebar());
}

function flushBrowseSearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = undefined;
  }
  void applyDebouncedSearch().then(() => scrollBrowseToTop());
}

async function clearBrowseFilters() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = undefined;
  }
  draftSearchQuery.value = '';
  draftCategory.value = '';
  draftPriceMin.value = '';
  draftPriceMax.value = '';
  draftSort.value = 'newest';
  draftGeoFilter.value = defaultGeoFilterState();
  applyDraftToApplied();
  closeSidebar();
  filterApplying.value = true;
  loading.value = true;
  listings.value = [];
  resetBrowseLoadedPool();
  void scrollBrowseToTop();
  try {
    invalidateCurrentListingCache();
    await loadInitialListings({ skipStalePlaceholder: true });
  } finally {
    filterApplying.value = false;
  }
}

function browseCacheUid(): string {
  return currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
}

function persistAppliedGeoFilter(): void {
  saveGeoFilterPrefs(browseCacheUid(), appliedGeoFilter.value);
}

function restoreGeoFilterFromPrefs(): GeoFilterState {
  const uid = browseCacheUid();
  clearGeoFilterPrefsIfUserChanged(uid);
  return hydrateGeoFilterFromPrefs(uid);
}

function onGeoFilterDraftChange() {
  if (draftGeoFilter.value.lat == null) {
    return;
  }
  if (draftSort.value === 'distance' && draftGeoFilter.value.lat == null) {
    draftSort.value = 'newest';
  }
}

function onGeoFilterApply() {
  onGeoFilterDraftChange();

  if (draftGeoFilter.value.lat == null || draftGeoFilter.value.lng == null) {
    appliedGeoFilter.value = {
      ...appliedGeoFilter.value,
      lat: null,
      lng: null,
      label: '',
      city: '',
      region: '',
      locating: false,
    };
    persistAppliedGeoFilter();
    if (effectiveViewMode.value === 'map') {
      if (mapBounds.value) {
        void loadMapListings(mapBounds.value);
      }
    } else {
      void reloadListingsForGeoChange();
    }
    return;
  }

  appliedGeoFilter.value = {
    ...appliedGeoFilter.value,
    lat: draftGeoFilter.value.lat,
    lng: draftGeoFilter.value.lng,
    label: draftGeoFilter.value.label,
    city: draftGeoFilter.value.city,
    region: draftGeoFilter.value.region,
    radiusMiles: draftGeoFilter.value.radiusMiles,
    locating: false,
  };
  persistAppliedGeoFilter();

  if (effectiveViewMode.value === 'map') {
    const viewport = viewportFromCenterRadius(
      appliedGeoFilter.value.lat!,
      appliedGeoFilter.value.lng!,
      appliedGeoFilter.value.radiusMiles,
    );
    mapBounds.value = viewport;
    void loadMapListings(viewport);
    return;
  }

  void reloadListingsForGeoChange();
}

async function reloadListingsForGeoChange() {
  resetBrowseLoadedPool();
  listings.value = [];
  loading.value = true;
  invalidateCurrentListingCache();
  await loadInitialListings({ skipStalePlaceholder: true });
}

function onMapGeoSearch(payload: MapGeoSearchPayload) {
  const radiusMiles = draftGeoFilter.value.radiusMiles;
  const nextGeo = {
    ...draftGeoFilter.value,
    enabled: true,
    lat: payload.lat,
    lng: payload.lng,
    label: payload.label,
    city: payload.city ?? draftGeoFilter.value.city,
    region: payload.region ?? draftGeoFilter.value.region,
    radiusMiles,
    locating: false,
  };
  draftGeoFilter.value = nextGeo;
  appliedGeoFilter.value = { ...nextGeo };
  persistAppliedGeoFilter();

  const viewport = viewportFromCenterRadius(payload.lat, payload.lng, radiusMiles);
  mapBounds.value = viewport;
  void loadMapListings(viewport);
}

function selectDraftCategory(categoryId: string, popAll: () => void) {
  draftCategory.value = categoryId;
  popAll();
}

function currentBrowseCacheKey(): string {
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  return browseFeedCacheKey(uid, selectedCommunity.value, appliedCategory.value || undefined);
}

function buildAppliedLocalCacheParams() {
  return buildBrowseLocalFilterKeyParams({
    communityId: selectedCommunity.value,
    categoryId: appliedCategory.value || undefined,
    q: appliedSearchQuery.value,
    priceMin: appliedPriceMin.value,
    priceMax: appliedPriceMax.value,
    lat: appliedGeoFilter.value.lat,
    lng: appliedGeoFilter.value.lng,
    radiusMiles: appliedGeoFilter.value.radiusMiles,
    sort: appliedSort.value,
  });
}

function currentBrowseLocalCacheKey(): string {
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  return resolveBrowseLocalCacheKey(uid, buildAppliedLocalCacheParams());
}

function persistCurrentBrowseLocalCache(pool = browseLoadedPool.value): void {
  if (pool.length === 0) {
    return;
  }

  persistBrowseLocalPool(currentBrowseLocalCacheKey(), pool, {
    hasMore: hasMore.value,
    searchPage: searchPage.value,
    searchQuery: appliedSearchQuery.value.trim() || undefined,
  });
}

function hydrateListingsFromLocalCache(): Listing[] | null {
  const localStale = getStaleBrowseLocalCache(currentBrowseLocalCacheKey());
  if (!localStale?.orderedIds.length) {
    return null;
  }

  return listingsFromCachePayload(localStale);
}

function buildSearchParams(page = 1, forceRefresh?: boolean) {
  const textSearchActive = appliedSearchQuery.value.trim().length > 0;
  const pageSize = textSearchActive
    ? Math.min(browseFeedPageSize.value, BROWSE_TEXT_SEARCH_PAGE_SIZE)
    : browseFeedPageSize.value;

  const params = {
    communityId: selectedCommunity.value,
    categoryId: appliedCategory.value || undefined,
    priceMin: appliedPriceMin.value ?? undefined,
    priceMax: appliedPriceMax.value ?? undefined,
    sort: appliedSort.value,
    page,
    pageSize,
    forceRefresh,
  };

  const query = appliedSearchQuery.value.trim();
  if (query) {
    Object.assign(params, { q: query });
  }

  if (isAppliedGeoActive.value) {
    Object.assign(params, {
      lat: appliedGeoFilter.value.lat!,
      lng: appliedGeoFilter.value.lng!,
      ...(bffBrowseEnabled
        ? { radiusMiles: appliedGeoFilter.value.radiusMiles }
        : { radiusKm: milesToKm(appliedGeoFilter.value.radiusMiles) }),
    });
  }

  return params;
}

function buildMapSearchParams(viewport: MapViewportSearch, page = 1, forceRefresh?: boolean) {
  const searchViewport = resolveMapSearchViewport(
    viewport,
    isAppliedGeoActive.value
      ? {
          lat: appliedGeoFilter.value.lat!,
          lng: appliedGeoFilter.value.lng!,
          radiusMiles: appliedGeoFilter.value.radiusMiles,
        }
      : null,
  );

  const base = buildSearchParams(page, forceRefresh);

  if (isAppliedGeoActive.value) {
    return {
      ...base,
      hasLocation: true,
      page,
      pageSize: BROWSE_MAP_SEARCH_PAGE_SIZE,
    };
  }

  return {
    ...base,
    lat: searchViewport.lat,
    lng: searchViewport.lng,
    radiusMiles: searchViewport.radiusMiles,
    hasLocation: true,
    page,
    pageSize: BROWSE_MAP_SEARCH_PAGE_SIZE,
  };
}

let mapFetchGeneration = 0;

async function loadMapListings(viewport: MapViewportSearch) {
  if (!bffBrowseEnabled) {
    communityMapLoading.value = false;
    return;
  }

  const generation = ++mapFetchGeneration;
  const searchViewport = resolveMapSearchViewport(
    viewport,
    isAppliedGeoActive.value
      ? {
          lat: appliedGeoFilter.value.lat!,
          lng: appliedGeoFilter.value.lng!,
          radiusMiles: appliedGeoFilter.value.radiusMiles,
        }
      : null,
  );
  const uid = currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
  const mapCacheKey = buildMapLocalCacheKey(uid, searchViewport);
  const localStale = getStaleBrowseLocalCache(mapCacheKey);
  let hadMapCache = false;

  if (localStale?.orderedIds.length) {
    hadMapCache = true;
    const cached = listingsFromCachePayload(localStale);
    mapListingsPool.value = cached;
    mapListings.value = applyMapListingFilters(cached);
    debugLog.debug('browse', 'Map localStorage hit — hydrating viewport', {
      cacheKey: mapCacheKey,
      count: cached.length,
    });
  }

  mapLoading.value = true;

  try {
    let mergedListings: Listing[] = hadMapCache ? [...mapListingsPool.value] : [];
    let latestPinGroups: BrowseMapPinGroup[] | null = mapPinGroups.value;
    let page = 1;
    let apiHasMore = true;

    while (apiHasMore && page <= BROWSE_MAP_MAX_PREFETCH_PAGES) {
      const result = await withTransientFirestoreRetry(
        () =>
          searchBrowseListings(
            buildMapSearchParams(searchViewport, page, hadMapCache && page === 1),
          ),
        { context: 'browse-map', user: currentUser.value },
      );

      if (generation !== mapFetchGeneration) {
        return;
      }

      mergedListings = hadMapCache && page === 1
        ? mergeFreshBrowseResultsOnTop(result.listings, mergedListings)
        : appendBrowseListings(mergedListings, result.listings);
      latestPinGroups = result.pinGroups?.length ? result.pinGroups : latestPinGroups;

      apiHasMore = resolveBffBrowseHasMore(
        result.hasMore,
        result.listings.length,
        BROWSE_MAP_SEARCH_PAGE_SIZE,
      );
      page += 1;

      if (result.listings.length === 0) {
        break;
      }
    }

    mapListingsPool.value = mergedListings;
    mapListings.value = applyMapListingFilters(mergedListings);
    mapPinGroups.value = latestPinGroups?.length ? latestPinGroups : null;

    persistBrowseLocalPool(mapCacheKey, mergedListings, {
      hasMore: apiHasMore,
      viewport: searchViewport,
    });

    debugLog.debug('browse', 'Map viewport fetch complete', {
      count: mergedListings.length,
      pagesFetched: page - 1,
      radiusMiles: searchViewport.radiusMiles,
      lat: searchViewport.lat,
      lng: searchViewport.lng,
      geoActive: isAppliedGeoActive.value,
    });
  } catch (err) {
    if (generation !== mapFetchGeneration) {
      return;
    }

    if (isSessionExpiredError(err)) {
      return;
    }

    debugLog.warn('browse', 'Map viewport fetch failed', {
      error: serializeError(err),
      viewport,
    });
  } finally {
    if (generation === mapFetchGeneration) {
      mapLoading.value = false;
      communityMapLoading.value = false;
    }
  }
}

function onMapBoundsChange(viewport: MapViewportSearch) {
  if (isAppliedGeoActive.value) {
    return;
  }

  mapBounds.value = viewport;
  if (effectiveViewMode.value !== 'map') {
    return;
  }
  void loadMapListings(viewport);
}

function onMapListingUnavailable(listingId: string) {
  mapListingsPool.value = mapListingsPool.value.filter((listing) => listing.id !== listingId);
  mapListings.value = mapListings.value.filter((listing) => listing.id !== listingId);
  mapPinGroups.value = null;
}

function refreshMapListingsIfActive() {
  if (effectiveViewMode.value !== 'map' || !mapBounds.value) {
    return;
  }
  void loadMapListings(mapBounds.value);
}

function currentSearchCacheKey(page = 1) {
  if (bffBrowseEnabled) {
    return browseSearchCacheKey(buildSearchParams(page));
  }
  return listingSearchCacheKey(buildSearchParams(page));
}

function applyBrowseFilters(listingsToFilter: Listing[], logSource?: 'local-feed' | 'cache-stale'): Listing[] {
  if (bffBrowseEnabled) {
    return listingsToFilter;
  }

  const filtered = applyBrowseListingFilters(listingsToFilter, {
    query: appliedSearchQuery.value,
    geo: isAppliedGeoActive.value
      ? {
          lat: appliedGeoFilter.value.lat!,
          lng: appliedGeoFilter.value.lng!,
          radiusKm: milesToKm(appliedGeoFilter.value.radiusMiles),
        }
      : null,
  });

  if (isAppliedGeoActive.value && logSource) {
    logGeoFilterOutcome(
      listingsToFilter,
      filtered,
      {
        enabled: true,
        lat: appliedGeoFilter.value.lat!,
        lng: appliedGeoFilter.value.lng!,
        radiusMiles: appliedGeoFilter.value.radiusMiles,
        centerLabel: appliedGeoFilter.value.label || 'your location',
        query: appliedSearchQuery.value.trim() || undefined,
        communityId: selectedCommunity.value,
        categoryId: appliedCategory.value || null,
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
  allItemsRevealed,
  onScroll: onLazyScroll,
} = useLazyReveal(listings, {
  contentRef,
  loading,
  minSkeletonMs: 200,
  gridColumnCount: cardsGridColumnCount,
  gridRowCount: computed(() =>
    effectiveViewMode.value === 'cards' ? gridRowCount.value : undefined,
  ),
  gridRowHeightPx,
});

const FILTER_APPLY_MIN_MS = 500;
const INITIAL_LOAD_MIN_MS = 1000;

let initialLoadCompleted = initialBrowse.hasPlaceholder;

const showResultsLoading = computed(
  () =>
    showSkeletons.value ||
    filterApplying.value ||
    initialLoadPending.value ||
    (loading.value && listings.value.length === 0),
);

const feedPendingSkeletonCount = computed(() =>
  computeFeedPendingSkeletonCount({
    loading: loading.value,
    showSkeletons: showSkeletons.value,
    loadingMore: loadingMore.value,
    refreshing: refreshing.value,
    feedHasMore: hasMore.value,
    allItemsRevealed: allItemsRevealed.value,
    trailingSkeletonCount: trailingSkeletonCount.value,
    gridColumnCount:
      effectiveViewMode.value === 'cards' ? gridColumnCount.value : undefined,
    visibleListingCount: visibleItems.value.length,
  }),
);

const combinedTrailingSkeletonCount = computed(() =>
  computeCombinedTrailingSkeletonCount({
    loading: loading.value,
    showSkeletons: showSkeletons.value,
    loadingMore: loadingMore.value,
    refreshing: refreshing.value,
    feedHasMore: hasMore.value,
    allItemsRevealed: allItemsRevealed.value,
    trailingSkeletonCount: trailingSkeletonCount.value,
  }),
);

const showEndOfList = computed(() =>
  computeShouldShowBrowseEndOfList({
    error: Boolean(error.value),
    loading: loading.value,
    showResultsLoading: showResultsLoading.value,
    loadingMore: loadingMore.value,
    refreshing: refreshing.value,
    initialLoadPending: initialLoadPending.value,
    feedHasMore: hasMore.value,
    allItemsRevealed: allItemsRevealed.value,
    isScrollable: isScrollable.value,
    atBottom: atBottom.value,
  }),
);

const showGuestPromo = computed(() => !currentUser.value && isMobileSidebar.value);

const showTopSellButton = computed(
  () =>
    Boolean(currentUser.value) &&
    !error.value &&
    (loading.value || showResultsLoading.value || !isScrollable.value),
);
const showBottomSellButton = computed(
  () =>
    Boolean(currentUser.value) &&
    !loading.value &&
    !error.value &&
    !showResultsLoading.value &&
    isScrollable.value &&
    atBottom.value,
);

const showNoListings = computed(
  () =>
    !error.value &&
    !loading.value &&
    !showResultsLoading.value &&
    !loadingMore.value &&
    listings.value.length === 0,
);

const browseEmptyState = computed(() =>
  resolveBrowseEmptyState({
    communityName: selectedCommunityName.value,
    searchQuery: appliedSearchQuery.value,
    categoryId: appliedCategory.value,
    priceMin: appliedPriceMin.value,
    priceMax: appliedPriceMax.value,
    geoActive: isAppliedGeoActive.value,
    geoLabel: appliedGeoFilter.value.label,
    geoRadiusMiles: appliedGeoFilter.value.radiusMiles,
  }),
);

const showUpdatingIndicator = computed(
  () => refreshing.value || bootstrapRefreshing.value,
);

let bottomObserver: IntersectionObserver | undefined;
let loadMoreLock = false;
const bffSearchPageFetches = new Map<number, Promise<boolean>>();

async function loadInitialListings(options?: {
  skipStalePlaceholder?: boolean;
  backgroundRefresh?: boolean;
}) {
  const cacheKey = currentBrowseCacheKey();
  const skipStalePlaceholder = options?.skipStalePlaceholder ?? false;
  const backgroundRefresh = options?.backgroundRefresh ?? false;
  const isInitialLoad = !initialLoadCompleted;
  const initialLoadStartedAt = isInitialLoad ? Date.now() : null;

  error.value = '';
  searchPage.value = 1;
  clearBffSearchPageFetches();

  const useBffSearch = bffBrowseEnabled || isApiSearchMode.value;
  const fetchGeneration = ++searchFetchGeneration;

  if (useBffSearch) {
    hasMore.value = false;
  }

  if (backgroundRefresh) {
    refreshing.value = listings.value.length > 0;
    if (!refreshing.value) {
      loading.value = true;
    }
  } else if (!useBffSearch) {
    if (!skipStalePlaceholder) {
      const localListings = hydrateListingsFromLocalCache();
      if (localListings?.length) {
        listings.value = applyBrowseFilters(localListings, 'cache-stale');
        if (!isTextSearchMode.value) {
          browseLoadedPool.value = listings.value;
        }
        const localStale = getStaleBrowseLocalCache(currentBrowseLocalCacheKey());
        hasMore.value = resolveCachedBrowseHasMore(
          localStale?.hasMore ?? false,
          localListings.length,
          browseFeedPageSize.value,
        );
        loading.value = false;
        debugLog.debug('browse', 'LocalStorage hit — showing stale feed placeholder', {
          cacheKey: currentBrowseLocalCacheKey(),
          count: localListings.length,
        });
      } else {
        const stale = getStaleBrowsePage(cacheKey) ?? getCachedBrowsePage(cacheKey);
        if (stale?.listings.length) {
          listings.value = applyBrowseFilters(stale.listings, 'cache-stale');
          if (!isTextSearchMode.value) {
            browseLoadedPool.value = listings.value;
          }
          lastFeedDoc.value = stale.lastDoc;
          hasMore.value = resolveCachedBrowseHasMore(
            stale.hasMore,
            stale.listings.length,
            browseFeedPageSize.value,
          );
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
      }
    } else {
      loading.value = true;
      listings.value = [];
      lastFeedDoc.value = null;
      hasMore.value = false;
    }
  } else if (!skipStalePlaceholder) {
    const localListings = hydrateListingsFromLocalCache();
    if (localListings?.length) {
      listings.value = localListings;
      browseLoadedPool.value = localListings;
      const localStale = getStaleBrowseLocalCache(currentBrowseLocalCacheKey());
      hasMore.value = resolveCachedBrowseHasMore(
        localStale?.hasMore ?? false,
        localListings.length,
        browseFeedPageSize.value,
      );
      searchPage.value = localStale?.searchPage ?? 1;
      loading.value = false;
      debugLog.debug('browse', 'LocalStorage hit — showing stale placeholder', {
        cacheKey: currentBrowseLocalCacheKey(),
        count: localListings.length,
      });
    } else {
      const searchKey = currentSearchCacheKey(1);
      const stale =
        getStaleCached<ListingSearchResult>(searchKey) ??
        getCached<ListingSearchResult>(searchKey);
      if (stale?.listings.length) {
        listings.value = stale.listings;
        browseLoadedPool.value = stale.listings;
        hasMore.value = resolveCachedBrowseHasMore(
          stale.hasMore,
          stale.listings.length,
          browseFeedPageSize.value,
        );
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
    }
    lastFeedDoc.value = null;
  } else {
    loading.value = true;
    listings.value = [];
    hasMore.value = false;
    lastFeedDoc.value = null;
  }

  const hadPlaceholder =
    listings.value.length > 0 && (backgroundRefresh || !skipStalePlaceholder);
  if (!backgroundRefresh) {
    refreshing.value = hadPlaceholder;
  }
  let keepLoadingAfterFailure = false;

  try {
    debugLog.debug('browse', 'Fetch start', {
      cacheKey,
      communityId: selectedCommunity.value,
      categoryId: appliedCategory.value || null,
      search: appliedSearchQuery.value.trim() || null,
      hadPlaceholder,
      placeholderCount: listings.value.length,
      geo: isAppliedGeoActive.value ? buildGeoFilterInputPayload(appliedGeoFilter.value) : null,
      bff: bffBrowseEnabled,
    });

    if (isInitialLoad) {
      await waitForBootstrap();
    }

    if (useBffSearch) {
      const searchFn = bffBrowseEnabled ? searchBrowseListings : searchListings;
      const result = await withTransientFirestoreRetry(
        () => searchFn(buildSearchParams(1, hadPlaceholder)),
        { context: 'browse-search', user: currentUser.value },
      );

      if (fetchGeneration !== searchFetchGeneration) {
        return;
      }

      const cachedBeforeFetch = hadPlaceholder ? [...listings.value] : [];
      const merged = hadPlaceholder
        ? mergeFreshBrowseResultsOnTop(result.listings, cachedBeforeFetch)
        : result.listings;

      listings.value = merged;
      browseLoadedPool.value = listings.value;
      hasMore.value = resolveBffBrowseHasMore(
        result.hasMore,
        result.listings.length,
        browseFeedPageSize.value,
      );
      searchPage.value = 1;
      persistCurrentBrowseLocalCache(merged);
      debugLog.debug('browse', 'Search fetch complete', {
        cacheKey,
        count: merged.length,
        freshCount: result.listings.length,
        hasMore: hasMore.value,
        apiHasMore: result.hasMore,
        engine: 'engine' in result ? result.engine : undefined,
      });
      logBrowsePagination('initial load complete (bff)', {
        page: 1,
        fetched: result.listings.length,
        hasMore: hasMore.value,
        engine: 'engine' in result ? result.engine : undefined,
      });
      if (hasMore.value && shouldPrefetchBrowseSearchBuffer(isTextSearchMode.value)) {
        void prefetchBrowseSearchBuffer(fetchGeneration);
      }
    } else {
      const page = await withTransientFirestoreRetry(
        () => fetchBrowsePage(selectedCommunity.value, {
          categoryId: appliedCategory.value || undefined,
          pageSize: browseFeedPageSize.value,
        }),
        { context: isAppliedGeoActive.value ? 'browse-feed-geo' : 'browse-feed', user: currentUser.value },
      );
      const filtered = applyBrowseFilters(page.listings, 'local-feed');
      const merged = hadPlaceholder
        ? mergeFreshBrowseResultsOnTop(filtered, listings.value)
        : filtered;
      listings.value = merged;
      if (!isTextSearchMode.value) {
        browseLoadedPool.value = merged;
      }
      lastFeedDoc.value = page.lastDoc;
      hasMore.value = resolveFirestoreFeedHasMore(
        page.hasMore,
        isAppliedGeoActive.value,
        bffBrowseEnabled,
      );
      setCachedBrowsePage(cacheKey, page);
      persistCurrentBrowseLocalCache(merged);
      debugLog.debug(
        'browse',
        isAppliedGeoActive.value ? 'Geo filter fetch complete' : 'Fetch complete',
        {
          cacheKey,
          count: filtered.length,
          feedCount: page.listings.length,
          hasMore: hasMore.value,
          geo: isAppliedGeoActive.value ? buildGeoFilterInputPayload(appliedGeoFilter.value) : null,
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
        categoryId: appliedCategory.value || null,
        search: appliedSearchQuery.value.trim() || null,
        error: serializeError(err),
      });
    }
  } finally {
    if (!keepLoadingAfterFailure) {
      loading.value = false;
    }
    refreshing.value = false;

    if (isInitialLoad && !keepLoadingAfterFailure) {
      initialLoadCompleted = true;
      const elapsed = initialLoadStartedAt != null ? Date.now() - initialLoadStartedAt : 0;
      const remaining = Math.max(0, INITIAL_LOAD_MIN_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      initialLoadPending.value = false;
    }

    refreshMapListingsIfActive();

    await nextTick(() => {
      void updateScrollState();
    });
  }
}

function invalidateCurrentListingCache() {
  if (bffBrowseEnabled || isApiSearchMode.value) {
    if (bffBrowseEnabled) {
      invalidateBrowseSearchCache(currentSearchCacheKey(1));
    } else {
      invalidateListingSearchCache(currentSearchCacheKey(1));
    }
    return;
  }

  invalidateBrowseFeedCache(currentBrowseCacheKey());
}

async function resolveFeedPaginationCursor(): Promise<DocumentSnapshot | null> {
  if (lastFeedDoc.value) {
    return lastFeedDoc.value;
  }

  const lastListing = listings.value.at(-1);
  if (!lastListing) {
    return null;
  }

  const snapshot = await getCommunityFeedDocSnapshot(selectedCommunity.value, lastListing.id);
  if (snapshot) {
    lastFeedDoc.value = snapshot;
  }

  return snapshot;
}

function logBrowsePagination(
  message: string,
  data?: Record<string, unknown>,
): void {
  debugLog.debug('browse-pagination', message, data);
  if (import.meta.env.DEV) {
    console.debug('[browse-pagination]', message, data ?? '');
  }
}

function logBrowsePaginationSkip(reason: string): void {
  logBrowsePagination('loadMore skipped', { reason });
}

function shouldPrefetchBrowseFeedNow(
  scrollEl: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
): boolean {
  const threshold =
    effectiveViewMode.value === 'cards'
      ? BROWSE_CARDS_REVEAL_PREFETCH_THRESHOLD
      : undefined;

  return shouldTriggerBrowseFeedPrefetch(
    scrollEl,
    visibleItems.value.length,
    listings.value.length,
    threshold,
  );
}

function browseLoadMoreSpinnerContext() {
  return {
    visibleCount: visibleItems.value.length,
    fetchedCount: listings.value.length,
    hasMore: hasMore.value,
  };
}

function clearBffSearchPageFetches(): void {
  bffSearchPageFetches.clear();
}

async function fetchBffSearchPage(
  page: number,
  options: {
    showLoadingMore: boolean;
    generation?: number;
  },
): Promise<boolean> {
  const inFlight = bffSearchPageFetches.get(page);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async (): Promise<boolean> => {
    if (options.generation != null && options.generation !== searchFetchGeneration) {
      return false;
    }

    if (page <= searchPage.value) {
      return true;
    }

    if (
      !options.showLoadingMore &&
      !canSilentlyPrefetchBrowseSearchPage(
        searchPage.value,
        page,
        isTextSearchMode.value,
      )
    ) {
      logBrowsePagination('prefetch page skipped — beyond buffer depth', {
        page,
        loadedPage: searchPage.value,
      });
      return false;
    }

    const listingCountBefore = listings.value.length;
    const showSpinner =
      options.showLoadingMore && shouldShowBrowseLoadMoreSpinner(browseLoadMoreSpinnerContext());

    if (showSpinner) {
      loadingMore.value = true;
    }

    try {
      const searchFn = bffBrowseEnabled ? searchBrowseListings : searchListings;
      const result = await searchFn(buildSearchParams(page, true));
      if (options.generation != null && options.generation !== searchFetchGeneration) {
        return false;
      }

      const applied = applyBrowseSearchPageResult(
        listings.value,
        result,
        browseFeedPageSize.value,
      );
      listings.value = applied.listings;
      browseLoadedPool.value = appendUniqueBrowseListings(
        browseLoadedPool.value,
        result.listings,
      );
      hasMore.value = applied.hasMore;
      searchPage.value = page;
      persistCurrentBrowseLocalCache(browseLoadedPool.value);
      invalidateCurrentListingCache();

      logBrowsePagination(
        showSpinner ? 'loadMore complete (bff)' : 'prefetch page complete (bff)',
        {
          page,
          fetched: result.listings.length,
          appended: applied.appendedCount,
          total: applied.listings.length,
          hasMore: hasMore.value,
          prefetchBuffer: !showSpinner,
          engine: 'engine' in result ? result.engine : undefined,
        },
      );

      if (applied.appendedCount === 0 && listingCountBefore === applied.listings.length) {
        logBrowsePagination('page fetch returned no new listings', { page });
      }

      return true;
    } catch (err) {
      debugLog.warn('browse', 'fetchBffSearchPage failed', {
        page,
        communityId: selectedCommunity.value,
        error: serializeError(err),
      });
      logBrowsePagination('page fetch failed', {
        page,
        communityId: selectedCommunity.value,
        error: serializeError(err),
      });
      return false;
    } finally {
      if (showSpinner) {
        loadingMore.value = false;
      }
    }
  })();

  bffSearchPageFetches.set(page, promise);
  try {
    return await promise;
  } finally {
    if (bffSearchPageFetches.get(page) === promise) {
      bffSearchPageFetches.delete(page);
    }
  }
}

async function prefetchBrowseSearchBuffer(
  generation: number,
  targetPages = browseSearchInitialPrefetchTarget(isTextSearchMode.value),
): Promise<void> {
  if (!(bffBrowseEnabled || isApiSearchMode.value)) {
    return;
  }

  const pages = nextBrowseSearchPagesToPrefetch(
    searchPage.value,
    hasMore.value,
    targetPages,
  );
  if (pages.length === 0) {
    return;
  }

  logBrowsePagination('prefetch buffer start', {
    pages,
    loadedPage: searchPage.value,
    targetPages,
  });

  for (const page of pages) {
    if (generation !== searchFetchGeneration) {
      logBrowsePagination('prefetch buffer aborted — stale generation', { page, generation });
      return;
    }
    if (!hasMore.value) {
      break;
    }

    const loaded = await fetchBffSearchPage(page, {
      showLoadingMore: false,
      generation,
    });
    if (!loaded || !hasMore.value) {
      break;
    }
  }

  if (generation === searchFetchGeneration) {
    logBrowsePagination('prefetch buffer complete', {
      loadedPage: searchPage.value,
      listingCount: listings.value.length,
      hasMore: hasMore.value,
    });
    await maintainBrowseSearchScrollBuffer(generation);
    await nextTick(() => {
      void updateScrollState();
    });
  }
}

async function maintainBrowseSearchScrollBuffer(generation?: number): Promise<void> {
  if (!(bffBrowseEnabled || isApiSearchMode.value) || !hasMore.value) {
    return;
  }

  const pages = browseSearchPagesToMaintainBuffer(
    searchPage.value,
    hasMore.value,
    BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  );
  if (pages.length === 0) {
    return;
  }

  logBrowsePagination('maintain scroll buffer', {
    pages,
    loadedPage: searchPage.value,
    pagesAhead: BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  });

  for (const page of pages) {
    if (generation != null && generation !== searchFetchGeneration) {
      return;
    }
    if (!hasMore.value) {
      break;
    }

    await fetchBffSearchPage(page, {
      showLoadingMore: false,
      generation,
    });
  }
}

async function fetchFirestoreFeedPage(options: { showLoadingMore: boolean }): Promise<boolean> {
  const listingCountBefore = listings.value.length;
  const showSpinner =
    options.showLoadingMore && shouldShowBrowseLoadMoreSpinner(browseLoadMoreSpinnerContext());

  if (showSpinner) {
    loadingMore.value = true;
  }

  try {
    const cursor = await resolveFeedPaginationCursor();
    if (!cursor) {
      debugLog.warn('browse', 'Pagination cursor missing — retrying feed from last listing', {
        communityId: selectedCommunity.value,
        listingCount: listings.value.length,
        lastListingId: listings.value.at(-1)?.id ?? null,
      });
      logBrowsePagination('loadMore aborted — cursor missing', {
        listingCount: listings.value.length,
        lastListingId: listings.value.at(-1)?.id ?? null,
      });
      return false;
    }

    const page = await fetchBrowsePage(selectedCommunity.value, {
      categoryId: appliedCategory.value || undefined,
      startAfterDoc: cursor,
      pageSize: browseFeedPageSize.value,
    });
    const filtered = applyBrowseFilters(page.listings);
    const appended = appendBrowseListings(listings.value, filtered);
    listings.value = appended;
    if (!isTextSearchMode.value) {
      browseLoadedPool.value = appendUniqueBrowseListings(browseLoadedPool.value, filtered);
    }
    lastFeedDoc.value = page.lastDoc;
    hasMore.value = page.hasMore;
    persistCurrentBrowseLocalCache(listings.value);
    invalidateCurrentListingCache();
    logBrowsePagination(
      showSpinner ? 'loadMore complete (firestore)' : 'prefetch page complete (firestore)',
      {
        fetched: filtered.length,
        appended: appended.length - listingCountBefore,
        total: appended.length,
        hasMore: hasMore.value,
        hasCursor: Boolean(page.lastDoc),
        prefetchBuffer: !showSpinner,
      },
    );
    return true;
  } catch (err) {
    debugLog.warn('browse', 'fetchFirestoreFeedPage failed', {
      communityId: selectedCommunity.value,
      error: serializeError(err),
    });
    logBrowsePagination('page fetch failed', {
      communityId: selectedCommunity.value,
      error: serializeError(err),
    });
    return false;
  } finally {
    if (showSpinner) {
      loadingMore.value = false;
    }
  }
}

function canPrefetchBrowseFeed(): boolean {
  return (
    effectiveViewMode.value !== 'map' &&
    hasMore.value &&
    !loading.value &&
    !refreshing.value &&
    !initialLoadPending.value &&
    !filterApplying.value &&
    listings.value.length > 0
  );
}

async function ensureBrowseFeedBuffer(): Promise<void> {
  if (!canPrefetchBrowseFeed()) {
    return;
  }

  const useBffSearch = bffBrowseEnabled || isApiSearchMode.value;
  if (!useBffSearch && (loadMoreLock || loadingMore.value)) {
    return;
  }

  const caughtUp =
    allItemsRevealed.value && visibleItems.value.length >= listings.value.length;
  const showCaughtUpSpinner = caughtUp && hasMore.value;

  if (showCaughtUpSpinner) {
    loadingMore.value = true;
  }

  try {
    if (useBffSearch) {
      await maintainBrowseSearchScrollBuffer(searchFetchGeneration);
    } else {
      await fetchFirestoreFeedPage({ showLoadingMore: false });
    }
  } finally {
    if (showCaughtUpSpinner) {
      loadingMore.value = false;
    }
  }
}

async function loadMoreListings() {
  if (effectiveViewMode.value === 'map') {
    logBrowsePaginationSkip('map-view');
    return;
  }

  if (
    isLoadMoreBlocked({
      feedHasMore: hasMore.value,
      loadingMore: loadingMore.value,
      loading: loading.value,
      refreshing: refreshing.value,
      initialLoadPending: initialLoadPending.value,
      filterApplying: filterApplying.value,
      loadMoreLock,
    })
  ) {
    if (!hasMore.value) {
      logBrowsePaginationSkip('feedHasMore=false');
    } else if (loadingMore.value) {
      logBrowsePaginationSkip('loadingMore');
    } else if (loading.value) {
      logBrowsePaginationSkip('loading');
    } else if (refreshing.value) {
      logBrowsePaginationSkip('refreshing');
    } else if (initialLoadPending.value) {
      logBrowsePaginationSkip('initialLoadPending');
    } else if (filterApplying.value) {
      logBrowsePaginationSkip('filterApplying');
    } else if (loadMoreLock) {
      logBrowsePaginationSkip('loadMoreLock');
    }
    return;
  }

  loadMoreLock = true;
  const listingCountBefore = listings.value.length;
  const useBffSearch = bffBrowseEnabled || isApiSearchMode.value;

  try {
    logBrowsePagination('loadMore start', {
      path: useBffSearch ? 'bff' : 'firestore',
      searchPage: searchPage.value,
      listingCount: listingCountBefore,
      hasMore: hasMore.value,
      hasCursor: Boolean(lastFeedDoc.value),
    });

    if (useBffSearch) {
      const nextPage = searchPage.value + 1;
      await fetchBffSearchPage(nextPage, {
        showLoadingMore: true,
        generation: searchFetchGeneration,
      });
    } else {
      await fetchFirestoreFeedPage({ showLoadingMore: true });
    }
  } catch (err) {
    debugLog.warn('browse', 'loadMoreListings failed', {
      communityId: selectedCommunity.value,
      error: serializeError(err),
    });
    logBrowsePagination('loadMore failed', {
      communityId: selectedCommunity.value,
      error: serializeError(err),
    });
  } finally {
    loadMoreLock = false;
    await nextTick(() => {
      void updateScrollState();
    });
  }
}

function reloadListings() {
  void loadInitialListings();
}

function onCommunityChange(event: CustomEvent) {
  selectedCommunity.value = event.detail.value;
  persistBrowseCommunity(selectedCommunity.value);
  resetBrowseLoadedPool();
  if (effectiveViewMode.value === 'map') {
    communityMapLoading.value = true;
  }
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

let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let searchFetchGeneration = 0;

async function applyDebouncedSearch() {
  const trimmedDraft = draftSearchQuery.value.trim();
  const trimmedApplied = appliedSearchQuery.value.trim();
  if (trimmedDraft === trimmedApplied) {
    return;
  }

  appliedSearchQuery.value = draftSearchQuery.value;
  searchPage.value = 1;
  hasMore.value = false;

  const hasLocalPreview =
    browseLoadedPool.value.length > 0 &&
    (trimmedDraft.length > 0 || trimmedApplied.length > 0);

  if (!hasLocalPreview && trimmedDraft.length > 0) {
    listings.value = [];
    loading.value = true;
  }

  invalidateCurrentListingCache();
  await loadInitialListings({
    skipStalePlaceholder: true,
    backgroundRefresh: hasLocalPreview,
  });
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

  if (
    !isScrollable.value &&
    hasMore.value &&
    !loading.value &&
    !loadingMore.value &&
    listings.value.length > 0
  ) {
    void ensureBrowseFeedBuffer();
  } else if (hasMore.value && shouldPrefetchBrowseFeedNow(scrollEl)) {
    void ensureBrowseFeedBuffer();
  }
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
        void ensureBrowseFeedBuffer();
        if (
          shouldShowBrowseLoadMoreSpinner(browseLoadMoreSpinnerContext()) &&
          !isLoadMoreBlocked({
            feedHasMore: hasMore.value,
            loadingMore: loadingMore.value,
            loading: loading.value,
            refreshing: refreshing.value,
            initialLoadPending: initialLoadPending.value,
            filterApplying: filterApplying.value,
            loadMoreLock,
          })
        ) {
          void loadMoreListings();
        }
      }
    },
    {
      root: null,
      threshold: 0.01,
      rootMargin: '0px 0px 200% 0px',
    },
  );

  bottomObserver.observe(bottomSentinelRef.value);
}

async function handleScroll() {
  await onLazyScroll();

  const ionContent = contentRef.value;
  if (!ionContent?.$el) {
    return;
  }

  const scrollEl = await ionContent.$el.getScrollElement();
  const contentScrollHeight = scrollEl.scrollHeight - sellActionsHeight(scrollEl);
  isScrollable.value = contentScrollHeight - scrollEl.clientHeight > 8;
  atBottom.value =
    scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 16;

  if (hasMore.value && shouldPrefetchBrowseFeedNow(scrollEl)) {
    void ensureBrowseFeedBuffer();
  }
}

watch(viewMode, (mode) => {
  persistBrowseViewMode(mode);
  if (normalizeBrowseViewMode(mode, bffBrowseEnabled) !== 'map') {
    mapFetchGeneration += 1;
    mapLoading.value = false;
    communityMapLoading.value = false;
  }
});

watch(draftSearchQuery, () => {
  applyLocalSearchPreview();

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = setTimeout(() => {
    void applyDebouncedSearch();
  }, BROWSE_SEARCH_DEBOUNCE_MS);
});

watch(sidebarOpen, (open) => {
  if (!isMobileSidebar.value) {
    return;
  }
  document.body.classList.toggle('browse-sidebar-open', open);
});

onMounted(() => {
  const restoredGeo = restoreGeoFilterFromPrefs();
  draftGeoFilter.value = restoredGeo;
  appliedGeoFilter.value = { ...restoredGeo };
  syncDraftFromApplied();

  if (
    restoredGeo.lat != null &&
    restoredGeo.lng != null &&
    effectiveViewMode.value === 'map'
  ) {
    mapBounds.value = viewportFromCenterRadius(
      restoredGeo.lat,
      restoredGeo.lng,
      restoredGeo.radiusMiles,
    );
  }

  mobileSidebarMediaQuery = window.matchMedia(MOBILE_SIDEBAR_QUERY);
  syncMobileSidebarMode();
  mobileSidebarMediaQuery.addEventListener('change', syncMobileSidebarMode);

  if (browseMainRef.value && typeof ResizeObserver !== 'undefined') {
    browseGridResizeObserver = new ResizeObserver(() => {
      void updateBrowseGridLayout();
    });
    browseGridResizeObserver.observe(browseMainRef.value);
  }

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

  void (async () => {
    await updateBrowseGridLayout();
    await loadInitialListings().catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to load listings';
      error.value = message;
      loading.value = false;
      initialLoadPending.value = false;
      initialLoadCompleted = true;
      debugLog.warn('browse', 'HomePage mount failed', {
        error: serializeError(err),
      });
    });
  })();

  window.addEventListener('resize', handleResize);
  void nextTick(() => {
    updateMobileChromeBottom();
  });
});

function handleResize() {
  syncMobileSidebarMode();
  void updateBrowseGridLayout().then(() => updateScrollState());
}

watch(browseCommunities, (communities) => {
  if (!communities.some((community) => community.id === selectedCommunity.value)) {
    selectedCommunity.value = ALL_COMMUNITY_ID;
  }
});

watch(selectedCommunity, (communityId) => {
  persistBrowseCommunity(communityId);
});

watch([allItemsRevealed, hasMore, () => listings.value.length], () => {
  if (allItemsRevealed.value && hasMore.value && !loading.value && !refreshing.value) {
    void ensureBrowseFeedBuffer();
  }
});

watch([showSkeletons, () => visibleItems.value.length, () => listings.value.length], () => {
  void nextTick(() => {
    void updateBrowseGridLayout();
    void updateScrollState();
  });
});

watch(effectiveViewMode, (mode) => {
  const normalized = normalizeBrowseViewMode(mode, bffBrowseEnabled);
  if (normalized === 'cards') {
    void nextTick(() => updateBrowseGridLayout());
  }
  if (normalized === 'map') {
    refreshMapListingsIfActive();
  }
});

onIonViewWillLeave(() => {
  closeSidebar();
  document.body.classList.remove('browse-sidebar-open');
});

onUnmounted(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  bottomObserver?.disconnect();
  browseGridResizeObserver?.disconnect();
  window.removeEventListener('resize', handleResize);
  mobileSidebarMediaQuery?.removeEventListener('change', syncMobileSidebarMode);
  document.body.classList.remove('browse-sidebar-open');
});

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
  padding: var(--fs-sidebar-inset);
  border-right: 1px solid var(--ion-color-step-150);
  background: var(--ion-background-color);
}

.sidebar-section + .sidebar-section {
  margin-top: var(--fs-section-gap);
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

.price-filter-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.price-filter-row ion-input {
  flex: 1;
  min-width: 0;
  --padding-start: 0.35rem;
  --padding-end: 0.35rem;
  font-size: 0.88rem;
}

.price-filter-sep {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.apply-filters-btn {
  margin-top: 1rem;
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

.community-row + .search-filter-row {
  margin-top: var(--fs-space-xs);
}

.search-filter-row {
  display: flex;
  align-items: center;
  gap: var(--fs-space-xs);
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

.results-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 12rem;
  padding: 3rem 1rem;
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

.browse-empty-clear {
  margin-top: var(--fs-space-xs);
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
  color: var(--ion-text-color);
  font-size: 1.45rem;
  line-height: 1;
  cursor: pointer;
}

.mobile-filter-toggle:focus-visible {
  outline: 2px solid var(--fs-focus-outline-color);
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
