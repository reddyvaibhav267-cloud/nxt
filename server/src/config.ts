import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function bool(v: string | undefined, fallback: boolean) {
  if (v === undefined || v === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(v.toLowerCase());
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  scrapingEnabled: bool(process.env.SCRAPING_ENABLED, true),
  dbPath: process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(here, '../data/nxt.db'),
  /** Refresh cadence per source — every hour, staggered by a few minutes. */
  schedule: {
    google_trends: '0 * * * *', // hourly at :00
    amazon: '5 * * * *', // hourly at :05
    tiktok: '10 * * * *', // hourly at :10
  } as Record<string, string>,
  /** Hard daily request caps per source (politeness). */
  dailyCaps: {
    google_trends: 60,
    amazon: 96,
    tiktok: 240,
  } as Record<string, number>,
};

export const GOOGLE_TRENDS_KEYWORDS: string[] = [
  // Primary keyword of the first 20 catalogue niches (4 batches of 5).
  'portable blender',
  'neck massager',
  'led dog collar',
  'sunset lamp',
  'mini projector',
  'car vacuum cleaner',
  'heated jacket',
  'smart water bottle',
  'led face mask',
  'magnetic building blocks',
  'monitor light bar',
  'packing cubes',
  'hydroponic kit',
  'open ear headphones',
  'bottle warmer',
  'sticker printer',
  'electric screwdriver',
  'ring light',
  'portable espresso maker',
  'hair straightener brush',
];

/**
 * Amazon category targets.
 * Best Sellers and New Releases are server-rendered (parseable with Cheerio).
 * Movers & Shakers is client-rendered — excluded because its HTML has no
 * product rows for a plain fetch.
 */
export const AMAZON_CATEGORIES: { id: string; name: string; path: string }[] = [
  { id: 'best-kitchen', name: 'Home & Kitchen', path: '/Best-Sellers-Kitchen-Appliances/zgbs/kitchen/' },
  { id: 'best-electronics', name: 'Electronics', path: '/Best-Sellers-Electronics/zgbs/electronics/' },
  { id: 'best-pet', name: 'Pet Supplies', path: '/Best-Sellers-Pet-Supplies/zgbs/pet-supplies/' },
  { id: 'best-beauty', name: 'Beauty & Care', path: '/Best-Sellers-Beauty-Personal-Care/zgbs/beauty/' },
  { id: 'best-sports', name: 'Sports & Outdoors', path: '/Best-Sellers-Sports-Outdoors/zgbs/sporting-goods/' },
  { id: 'best-toys', name: 'Toys & Games', path: '/Best-Sellers-Toys-Games/zgbs/toys-and-games/' },
  { id: 'best-baby', name: 'Baby', path: '/Best-Sellers-Baby/zgbs/baby-products/' },
  { id: 'best-tools', name: 'Tools & Home Improvement', path: '/Best-Sellers-Tools-Home-Improvement/zgbs/hi/' },
  { id: 'new-kitchen', name: 'Home & Kitchen', path: '/gp/new-releases/kitchen/' },
  { id: 'new-electronics', name: 'Electronics', path: '/gp/new-releases/electronics/' },
];
