import type { Listing } from '@/types';
import { haversineDistanceMiles } from '@/features/listings/utils/geoDistance';

/** Max distance (miles) between listings from the same seller to share one pin (~105 ft). */
export const BROWSE_MAP_AGGREGATE_RADIUS_MILES = 0.02;

/** Decimal places for stable pin keys after clustering. */
export const BROWSE_MAP_LOCATION_PRECISION = 4;

/** Max in-memory memo entries for pin aggregation (LRU eviction). */
export const BROWSE_MAP_PIN_AGGREGATION_CACHE_MAX = 32;

/** Single-item pin — Ionic primary blue (FirmShake handshake figure). */
export const BROWSE_MAP_SINGLE_PIN_COLOR = '#3880ff';

/** Same-seller multi-listing pin — Ionic success green (FirmShake handshake figure). */
export const BROWSE_MAP_AGGREGATED_PIN_COLOR = '#2dd36f';

export type BrowseMapPinKind = 'single' | 'aggregated';

/** BFF browse search `pinGroups` payload (listingIds only). */
export interface BrowseMapPinGroupSummary {
  key: string;
  kind: BrowseMapPinKind;
  sellerId: string;
  position: { lat: number; lng: number };
  listingIds: string[];
}

export interface BrowseMapPinGroup {
  /** Stable id: sellerId + rounded lat/lng bucket. */
  key: string;
  kind: BrowseMapPinKind;
  sellerId: string;
  position: { lat: number; lng: number };
  listings: Listing[];
}

export function locationBucketKey(
  lat: number,
  lng: number,
  precision = BROWSE_MAP_LOCATION_PRECISION,
): string {
  return `${lat.toFixed(precision)}:${lng.toFixed(precision)}`;
}

export function browseMapPinGroupKey(
  sellerId: string,
  lat: number,
  lng: number,
  precision = BROWSE_MAP_LOCATION_PRECISION,
): string {
  return `${sellerId}:${locationBucketKey(lat, lng, precision)}`;
}

function compareListingsForPinGroup(a: Listing, b: Listing): number {
  const titleCompare = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  if (titleCompare !== 0) {
    return titleCompare;
  }
  return a.id.localeCompare(b.id);
}

function centroidPosition(listings: Listing[]): { lat: number; lng: number } {
  let latSum = 0;
  let lngSum = 0;
  for (const listing of listings) {
    latSum += listing.location!.lat;
    lngSum += listing.location!.lng;
  }
  return {
    lat: latSum / listings.length,
    lng: lngSum / listings.length,
  };
}

function listingsWithinRadius(
  anchor: Listing,
  candidates: Listing[],
  radiusMiles: number,
): Listing[] {
  return candidates.filter((candidate) => {
    const anchorLocation = anchor.location!;
    const candidateLocation = candidate.location!;
    return (
      haversineDistanceMiles(
        anchorLocation.lat,
        anchorLocation.lng,
        candidateLocation.lat,
        candidateLocation.lng,
      ) <= radiusMiles
    );
  });
}

function clusterSellerListings(
  listings: Listing[],
  radiusMiles = BROWSE_MAP_AGGREGATE_RADIUS_MILES,
): Listing[][] {
  const sorted = [...listings].sort(compareListingsForPinGroup);
  const remaining = [...sorted];
  const clusters: Listing[][] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const cluster = listingsWithinRadius(seed, [seed, ...remaining], radiusMiles);
    const clusterIds = new Set(cluster.map((listing) => listing.id));

    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (clusterIds.has(remaining[index].id)) {
        remaining.splice(index, 1);
      }
    }

    clusters.push(cluster.sort(compareListingsForPinGroup));
  }

  return clusters;
}

const pinAggregationCache = new Map<string, BrowseMapPinGroup[]>();

/** Stable cache key from listing id, seller, and rounded coordinates. */
export function buildBrowseMapListingsCacheKey(listings: Listing[]): string {
  if (listings.length === 0) {
    return 'empty';
  }

  const parts = listings
    .filter(
      (listing) =>
        listing.location?.lat != null &&
        listing.location?.lng != null &&
        listing.sellerId,
    )
    .map(
      (listing) =>
        `${listing.id}:${listing.sellerId}:${locationBucketKey(
          listing.location!.lat,
          listing.location!.lng,
        )}`,
    )
    .sort();

  return parts.join('|');
}

export function clearBrowseMapPinAggregationCache(): void {
  pinAggregationCache.clear();
}

/** Hydrate BFF pin summaries with full listing objects from the current map pool. */
export function hydrateBrowseMapPinGroups(
  summaries: BrowseMapPinGroupSummary[],
  listings: Listing[],
): BrowseMapPinGroup[] {
  const listingsById = new Map(listings.map((listing) => [listing.id, listing]));

  return summaries
    .map((summary) => {
      const groupListings = summary.listingIds
        .map((listingId) => listingsById.get(listingId))
        .filter((listing): listing is Listing => listing != null)
        .sort(compareListingsForPinGroup);

      if (groupListings.length === 0) {
        return null;
      }

      return {
        key: summary.key,
        kind: groupListings.length > 1 ? 'aggregated' : 'single',
        sellerId: summary.sellerId,
        position: summary.position,
        listings: groupListings,
      } satisfies BrowseMapPinGroup;
    })
    .filter((group): group is BrowseMapPinGroup => group != null);
}

/**
 * Group browse map listings into pins. Same seller + nearby coordinates → one pin;
 * different sellers at the same coordinates stay separate; same seller at different
 * locations stay separate.
 */
export function aggregateBrowseMapPins(listings: Listing[]): BrowseMapPinGroup[] {
  const cacheKey = buildBrowseMapListingsCacheKey(listings);
  const cached = pinAggregationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pinGroups = aggregateBrowseMapPinsUncached(listings);
  if (pinAggregationCache.size >= BROWSE_MAP_PIN_AGGREGATION_CACHE_MAX) {
    const oldestKey = pinAggregationCache.keys().next().value;
    if (oldestKey) {
      pinAggregationCache.delete(oldestKey);
    }
  }
  pinAggregationCache.set(cacheKey, pinGroups);
  return pinGroups;
}

function aggregateBrowseMapPinsUncached(listings: Listing[]): BrowseMapPinGroup[] {
  const bySeller = new Map<string, Listing[]>();

  for (const listing of listings) {
    const location = listing.location;
    if (location?.lat == null || location?.lng == null || !listing.sellerId) {
      continue;
    }

    const sellerListings = bySeller.get(listing.sellerId) ?? [];
    sellerListings.push(listing);
    bySeller.set(listing.sellerId, sellerListings);
  }

  const pinGroups: BrowseMapPinGroup[] = [];

  for (const [sellerId, sellerListings] of bySeller) {
    const clusters = clusterSellerListings(sellerListings);

    for (const clusterListings of clusters) {
      const position = centroidPosition(clusterListings);
      const key = browseMapPinGroupKey(sellerId, position.lat, position.lng);

      pinGroups.push({
        key,
        kind: clusterListings.length > 1 ? 'aggregated' : 'single',
        sellerId,
        position,
        listings: clusterListings,
      });
    }
  }

  return pinGroups.sort((a, b) => a.key.localeCompare(b.key));
}

export function browseMapPinGroupsSyncKey(pinGroups: BrowseMapPinGroup[]): string {
  return pinGroups
    .map((group) => `${group.key}:${group.listings.map((listing) => listing.id).join('|')}`)
    .join(',');
}

export function isBrowseMapPinGroupFullyUnavailable(
  pinGroup: BrowseMapPinGroup,
  unavailableListingIds: ReadonlySet<string>,
): boolean {
  return pinGroup.listings.every((listing) => unavailableListingIds.has(listing.id));
}

export function browseMapPinGroupHasAvailableListing(
  pinGroup: BrowseMapPinGroup,
  unavailableListingIds: ReadonlySet<string>,
): boolean {
  return pinGroup.listings.some((listing) => !unavailableListingIds.has(listing.id));
}

/** Skip pan when the same pinned pin is clicked to dismiss its popup. */
export function shouldPanMapOnPinClick(
  activePinKey: string | null | undefined,
  clickedPinKey: string,
  popupPinned: boolean,
): boolean {
  return !(activePinKey === clickedPinKey && popupPinned);
}

export function browseMapPinIconSvg(kind: BrowseMapPinKind): string {
  const fill =
    kind === 'aggregated' ? BROWSE_MAP_AGGREGATED_PIN_COLOR : BROWSE_MAP_SINGLE_PIN_COLOR;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" role="img" aria-hidden="true">
  <path fill="${fill}" stroke="#ffffff" stroke-width="1.5" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"/>
  <circle cx="14" cy="14" r="5" fill="#ffffff"/>
</svg>`;
}

export function browseMapPinIconDataUrl(kind: BrowseMapPinKind): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(browseMapPinIconSvg(kind))}`;
}

export interface BrowseMapPinIconConfig {
  url: string;
  scaledWidth: number;
  scaledHeight: number;
  anchorX: number;
  anchorY: number;
}

export function browseMapPinIconConfig(kind: BrowseMapPinKind): BrowseMapPinIconConfig {
  return {
    url: browseMapPinIconDataUrl(kind),
    scaledWidth: 28,
    scaledHeight: 40,
    anchorX: 14,
    anchorY: 40,
  };
}

export interface BrowseMapPinLabelConfig {
  text: string;
  color: string;
  fontSize: string;
  fontWeight: string;
}

export function browseMapPinLabelConfig(
  pinGroup: BrowseMapPinGroup,
): BrowseMapPinLabelConfig | undefined {
  if (pinGroup.kind !== 'aggregated') {
    return undefined;
  }

  return {
    text: String(pinGroup.listings.length),
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
  };
}
