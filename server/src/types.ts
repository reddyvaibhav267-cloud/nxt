/** Shared domain types for the nxt trend engine. */

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

/** A niche = a dropshipping vertical we track. */
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
  /** Rank delta since previous snapshot (positive = climbing). */
  rankDelta: number | null;
  velocity: number;
  score: number;
  imageUrl: string | null;
  url: string | null;
  metricLabel: string;
  metricValue: number;
  observedAt: string;
}

/** One point of a keyword's interest-over-time series. */
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

export const SOURCE_LABELS: Record<SourceId, string> = {
  google_trends: 'Google Trends',
  amazon: 'Amazon',
  tiktok: 'TikTok',
  seed: 'Seed',
};
