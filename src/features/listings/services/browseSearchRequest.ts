import { loggedFetch } from '@/common/debug/loggedFetch';
import { authHeaders } from '@/common/services/api';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import type { BrowseMapPinGroupSummary } from '@/features/listings/utils/browseMapPinAggregation';

export type BrowseSort = 'newest' | 'price_asc' | 'price_desc' | 'distance';

export interface BrowseSearchParams {
  q?: string;
  communityId?: string;
  categoryId?: string;
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  hasLocation?: boolean;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  sort?: BrowseSort;
  page?: number;
  pageSize?: number;
  forceRefresh?: boolean;
}

export type BrowseSearchEndpoint = 'search' | 'summary';

export interface BrowseSearchApiPayload {
  listings: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  engine?: string;
  shape?: string;
  pinGroups?: BrowseMapPinGroupSummary[];
}

/** Shared JSON body for POST /api/v1/browse/search and /summary. */
export function buildBrowseSearchRequestBody(
  params: BrowseSearchParams,
  page: number,
  pageSize: number,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    communityId: params.communityId ?? 'all',
    page,
    pageSize,
    sort: params.sort ?? 'newest',
  };

  if (params.q) body.q = params.q;
  if (params.categoryId) body.categoryId = params.categoryId;
  if (params.categoryIds?.length) body.categoryIds = params.categoryIds;
  if (params.priceMin != null) body.priceMin = params.priceMin;
  if (params.priceMax != null) body.priceMax = params.priceMax;
  if (params.hasLocation != null) body.hasLocation = params.hasLocation;
  if (params.lat != null) body.lat = params.lat;
  if (params.lng != null) body.lng = params.lng;
  if (params.radiusMiles != null) body.radiusMiles = params.radiusMiles;

  return body;
}

export async function fetchBrowseSearchEndpoint(
  endpoint: BrowseSearchEndpoint,
  params: BrowseSearchParams,
  page: number,
  pageSize: number,
): Promise<{ ok: true; payload: BrowseSearchApiPayload } | { ok: false; status: number }> {
  const body = buildBrowseSearchRequestBody(params, page, pageSize);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const auth = await authHeaders();
  if (typeof auth === 'object' && auth && 'Authorization' in auth && auth.Authorization) {
    headers.Authorization = String(auth.Authorization);
  }

  const path = `/api/v1/browse/${endpoint}`;
  const response = await loggedFetch(
    `${getApiBaseUrl()}${path}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    { category: 'browse-bff', label: `POST ${path}` },
  );

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const payload = (await response.json()) as BrowseSearchApiPayload;
  return { ok: true, payload };
}
