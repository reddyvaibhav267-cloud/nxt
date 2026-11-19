/** Mirrors server/src/types.ts — kept separate so the client bundle stays clean. */

export type SourceId = 'google_trends' | 'amazon' | 'tiktok' | 'seed';
export type SourceStatus = 'live' | 'degraded' | 'fallback' | 'stale';

export interface SourceHealth {
  source: SourceId;
  status: SourceStatus;
  lastOkAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  itemCount: number;
}

export interface Niche {
  slug: string;
  name: string;
  code: string;
  category: string;
  description: string;
  keywords: string[];
  marginBand: 'low' | 'mid' | 'high';
  avgPriceUsd: number;
  saturation: number;
  score: number;
  wowGrowth: number;
  momGrowth: number;
  demandIndex: number;
  productCount: number;
  emoji?: string;
}

export interface Product {
  id: string;
  nicheSlug: string;
  title: string;
  source: SourceId;
  priceUsd: number | null;
  rank: number | null;
  rankDelta: number | null;
  velocity: number;
  score: number;
  imageUrl: string | null;
  url: string | null;
  metricLabel: string;
  metricValue: number;
  observedAt: string;
}

export interface SeriesPoint {
  t: string;
  v: number;
}

export interface TrendSeries {
  keyword: string;
  nicheSlug: string | null;
  points: SeriesPoint[];
  latest: number;
  wowChange: number;
  source: SourceId;
}

export interface Stats {
  nichesTracked: number;
  productsTracked: number;
  dataPoints: number;
  avgOpportunity: number;
  refreshesToday: number;
  lastRefreshAt: string | null;
}

export interface RefreshEvent {
  type: 'refresh';
  source: SourceId;
  status: 'ok' | 'error';
  at: string;
  count: number;
  message?: string;
}

export interface ApiEnvelope<T> {
  ok: true;
  data: T;
  meta: { generatedAt: string; fallback: boolean; sources: SourceHealth[] };
}

export interface NicheDetail {
  niche: Niche;
  series: TrendSeries[];
  products: Product[];
  related: Niche[];
}
