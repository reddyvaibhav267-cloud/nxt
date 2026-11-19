import type { Niche, Product } from '../types.js';
import { NICHE_SEEDS } from '../db/seed-data.js';

/**
 * Opportunity score: demand velocity, margin proxy and inverse saturation.
 * Weights chosen so a fast-rising, unsaturated niche with a healthy margin
 * band outranks a crowded one even if its raw interest index is lower.
 */
const WEIGHTS = {
  demand: 0.34,
  growth: 0.28,
  headroom: 0.22,
  margin: 0.16,
};

const MARGIN_SCORE: Record<Niche['marginBand'], number> = { low: 40, mid: 68, high: 92 };

export function opportunityScore(n: {
  demandIndex: number;
  wowGrowth: number;
  saturation: number;
  marginBand: Niche['marginBand'];
}): number {
  const demand = clamp(n.demandIndex, 0, 100);
  const growth = clamp(50 + n.wowGrowth * 2.2, 0, 100);
  const headroom = (1 - clamp(n.saturation, 0, 1)) * 100;
  const margin = MARGIN_SCORE[n.marginBand];

  const raw =
    WEIGHTS.demand * demand +
    WEIGHTS.growth * growth +
    WEIGHTS.headroom * headroom +
    WEIGHTS.margin * margin;

  return Math.round(clamp(raw, 0, 100));
}

/** Blend a live product's source metrics into a comparable 0-100 score. */
export function productScore(p: {
  velocity: number;
  rankDelta: number | null;
  rank: number | null;
  metricValue: number;
  source: string;
  /** Demand index of the assigned niche — breaks ties between equal-rank rows. */
  demandIndex?: number;
}): number {
  const velocity = clamp(p.velocity, 0, 100);
  const deltaBoost = p.rankDelta ? clamp(Math.log10(Math.abs(p.rankDelta) + 1) * 14, 0, 18) : 0;
  // Rank decays logarithmically: #1 scores 14, #5 ~8, #10 ~7, #50 0.
  // (A linear cap flattens everything inside the top 10 into a tie.)
  const rankBoost = p.rank
    ? clamp(14 * (1 - Math.log(Math.min(p.rank, 50)) / Math.log(50)), 0, 14)
    : 4;
  const sourceBoost = p.source === 'tiktok' ? 5 : p.source === 'amazon' ? 3 : 0;
  const metricBoost =
    p.source === 'tiktok' ? clamp(Math.log10(p.metricValue + 1) * 4, 0, 14) : 0;
  const demandBoost = p.demandIndex ? clamp((p.demandIndex - 70) * 0.35, 0, 11) : 0;

  return Math.round(
    clamp(
      velocity * 0.58 + deltaBoost + rankBoost + metricBoost + sourceBoost + demandBoost,
      0,
      100,
    ),
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Re-score every niche from its current growth/saturation inputs. */
export function rescoreNiches(niches: Niche[]): Niche[] {
  return niches.map((n) => ({ ...n, score: opportunityScore(n) }));
}

export function nicheSlugForCategory(category: string): string {
  const map: Record<string, string> = {
    'Home & Kitchen': 'portable-kitchen',
    'Beauty & Care': 'beauty-devices',
    'Sports & Outdoors': 'outdoor-comfort',
    Electronics: 'mobile-workstation',
    'Pet Supplies': 'pet-tech',
    'Toys & Games': 'kids-stem-play',
    Baby: 'baby-essentials',
    'Tools & Home Improvement': 'diy-tools',
    'Office Products': 'desk-aesthetics',
    Camera: 'creator-gear',
  };
  return map[category] ?? 'mobile-workstation';
}

export function nicheForKeyword(keyword: string): string | null {
  const found = NICHE_SEEDS.find((n) => n.keywords.includes(keyword));
  return found?.slug ?? null;
}

export function productNicheForSource(source: string, index: number, hint?: string | null): string {
  if (hint) return hint;
  const slugs = NICHE_SEEDS.map((n) => n.slug);
  // Deterministic pick so the same source row keeps its niche across refreshes.
  const offset = source === 'amazon' ? 0 : source === 'tiktok' ? 5 : 9;
  return slugs[(index + offset) % slugs.length];
}

export type { Product };
