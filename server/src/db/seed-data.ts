import type { Niche, Product, SeriesPoint } from '../types.js';
import { hashString, mulberry32 } from '../lib/rng.js';

interface NicheSeed {
  slug: string;
  name: string;
  category: string;
  description: string;
  keywords: string[];
  marginBand: 'low' | 'mid' | 'high';
  avgPriceUsd: number;
  saturation: number;
  /** Base weekly growth % used to synthesise the series. */
  baseGrowth: number;
  demandIndex: number;
}

export const NICHE_SEEDS: NicheSeed[] = [
  {
    slug: 'portable-kitchen',
    name: 'Portable Kitchen',
    category: 'Home & Kitchen',
    description:
      'Compact appliances for small-space living: personal blenders, electric lunch boxes, cordless frothers.',
    keywords: ['portable blender', 'electric lunch box', 'milk frother', 'mini rice cooker'],
    marginBand: 'mid',
    avgPriceUsd: 34,
    saturation: 0.62,
    baseGrowth: 14,
    demandIndex: 88,
  },
  {
    slug: 'recovery-wellness',
    name: 'Recovery & Wellness',
    category: 'Health & Beauty',
    description:
      'At-home recovery tools — percussive massagers, acupressure mats, red-light masks, posture aids.',
    keywords: ['neck massager', 'acupressure mat', 'red light therapy mask', 'posture corrector'],
    marginBand: 'high',
    avgPriceUsd: 48,
    saturation: 0.48,
    baseGrowth: 22,
    demandIndex: 91,
  },
  {
    slug: 'pet-tech',
    name: 'Pet Tech',
    category: 'Pet Supplies',
    description:
      'Smart collars, GPS trackers, automated feeders and grooming gadgets for modern pet owners.',
    keywords: ['led dog collar', 'pet hair remover', 'automatic cat feeder', 'dog gps tracker'],
    marginBand: 'mid',
    avgPriceUsd: 29,
    saturation: 0.41,
    baseGrowth: 19,
    demandIndex: 84,
  },
  {
    slug: 'ambient-lighting',
    name: 'Ambient Lighting',
    category: 'Home & Living',
    description:
      'Mood-first lighting: sunset lamps, galaxy projectors, LED strips and scene-setting bulbs.',
    keywords: ['sunset lamp', 'galaxy projector', 'led strip lights', 'star projector'],
    marginBand: 'high',
    avgPriceUsd: 26,
    saturation: 0.71,
    baseGrowth: 9,
    demandIndex: 79,
  },
  {
    slug: 'mobile-workstation',
    name: 'Mobile Workstation',
    category: 'Electronics',
    description:
      'Nomad-friendly gear: mini projectors, portable monitors, ergonomic keyboards and laptop risers.',
    keywords: ['mini projector', 'portable monitor', 'ergonomic keyboard', 'laptop stand'],
    marginBand: 'mid',
    avgPriceUsd: 72,
    saturation: 0.55,
    baseGrowth: 16,
    demandIndex: 86,
  },
  {
    slug: 'car-essentials',
    name: 'Car Essentials',
    category: 'Automotive',
    description:
      'Interior upgrades and maintenance gadgets — cordless vacs, organizers, headrest mounts.',
    keywords: ['car vacuum cleaner', 'car organizer', 'headrest phone mount', 'tire inflator'],
    marginBand: 'low',
    avgPriceUsd: 24,
    saturation: 0.66,
    baseGrowth: 7,
    demandIndex: 74,
  },
  {
    slug: 'outdoor-comfort',
    name: 'Outdoor Comfort',
    category: 'Sports & Outdoors',
    description:
      'All-season outdoor gear: heated apparel, cooling towels, portable hammocks and camp lighting.',
    keywords: ['heated jacket', 'cooling towel', 'portable hammock', 'camping lantern'],
    marginBand: 'high',
    avgPriceUsd: 56,
    saturation: 0.37,
    baseGrowth: 25,
    demandIndex: 82,
  },
  {
    slug: 'hydration-smart',
    name: 'Smart Hydration',
    category: 'Health & Beauty',
    description:
      'Tracked hydration and temperature gear — smart bottles, insulated tumblers, UV purifiers.',
    keywords: ['smart water bottle', 'insulated tumbler', 'uv water purifier', 'bottle with straw'],
    marginBand: 'mid',
    avgPriceUsd: 31,
    saturation: 0.52,
    baseGrowth: 12,
    demandIndex: 77,
  },
  {
    slug: 'beauty-devices',
    name: 'Beauty Devices',
    category: 'Health & Beauty',
    description:
      'Salon-at-home electronics: LED masks, microcurrent tools, scalp massagers, nail lamps.',
    keywords: ['led face mask', 'microcurrent device', 'scalp massager', 'nail lamp'],
    marginBand: 'high',
    avgPriceUsd: 64,
    saturation: 0.58,
    baseGrowth: 20,
    demandIndex: 89,
  },
  {
    slug: 'kids-stem-play',
    name: 'Kids STEM Play',
    category: 'Toys & Games',
    description:
      'Screen-free learning toys, magnetic building sets, science kits and toddler puzzles.',
    keywords: ['magnetic building blocks', 'stem toy', 'kids camera', 'montessori toy'],
    marginBand: 'mid',
    avgPriceUsd: 33,
    saturation: 0.44,
    baseGrowth: 15,
    demandIndex: 80,
  },
  {
    slug: 'desk-aesthetics',
    name: 'Desk Aesthetics',
    category: 'Office',
    description:
      'Cable-free, camera-ready desks: monitor light bars, felt organizers, mechanical accessories.',
    keywords: ['monitor light bar', 'desk mat', 'cable management', 'mechanical keyboard'],
    marginBand: 'mid',
    avgPriceUsd: 38,
    saturation: 0.49,
    baseGrowth: 17,
    demandIndex: 83,
  },
  {
    slug: 'travel-smart',
    name: 'Travel Smart',
    category: 'Travel',
    description:
      'Packable problem-solvers: compression cubes, anti-theft bags, universal adapters, neck pillows.',
    keywords: ['packing cubes', 'anti theft backpack', 'travel adapter', 'neck pillow'],
    marginBand: 'low',
    avgPriceUsd: 27,
    saturation: 0.6,
    baseGrowth: 11,
    demandIndex: 76,
  },
  {
    slug: 'garden-productivity',
    name: 'Garden Productivity',
    category: 'Home & Garden',
    description:
      'Small-space growing: self-watering planters, hydroponic kits, shears and soil meters.',
    keywords: ['hydroponic kit', 'self watering planter', 'plant pruner', 'soil moisture meter'],
    marginBand: 'mid',
    avgPriceUsd: 42,
    saturation: 0.35,
    baseGrowth: 27,
    demandIndex: 78,
  },
  {
    slug: 'audio-personal',
    name: 'Personal Audio',
    category: 'Electronics',
    description:
      'Budget audiophile and sleep audio: open-ear buds, sleep headphones, voice recorders.',
    keywords: ['open ear headphones', 'sleep headphones', 'voice recorder', 'clip on mic'],
    marginBand: 'low',
    avgPriceUsd: 35,
    saturation: 0.69,
    baseGrowth: 8,
    demandIndex: 81,
  },
  {
    slug: 'baby-essentials',
    name: 'Baby Essentials',
    category: 'Baby',
    description:
      'First-year parent problem-solvers: bottle warmers, stroller organizers, soothing gadgets.',
    keywords: ['bottle warmer', 'stroller organizer', 'baby nasal aspirator', 'white noise machine'],
    marginBand: 'mid',
    avgPriceUsd: 32,
    saturation: 0.43,
    baseGrowth: 18,
    demandIndex: 85,
  },
  {
    slug: 'craft-stationery',
    name: 'Craft & Stationery',
    category: 'Arts & Crafts',
    description:
      'Creator-grade craft tools: sticker printers, heat pens, calligraphy sets and journal gear.',
    keywords: ['sticker printer', 'heat transfer pen', 'calligraphy pen set', 'washi tape set'],
    marginBand: 'mid',
    avgPriceUsd: 41,
    saturation: 0.38,
    baseGrowth: 21,
    demandIndex: 75,
  },
  {
    slug: 'diy-tools',
    name: 'DIY Power Tools',
    category: 'Tools & Home Improvement',
    description:
      'Handy-home power tools: electric screwdrivers, laser measures, stud finders, compact drills.',
    keywords: ['electric screwdriver', 'laser measure', 'stud finder', 'mini drill'],
    marginBand: 'mid',
    avgPriceUsd: 52,
    saturation: 0.47,
    baseGrowth: 15,
    demandIndex: 79,
  },
  {
    slug: 'creator-gear',
    name: 'Creator Gear',
    category: 'Camera & Photo',
    description:
      'Content-creation kit: ring lights, phone gimbals, bi-color video lights and wireless mics.',
    keywords: ['ring light', 'phone gimbal', 'video light', 'wireless lavalier mic'],
    marginBand: 'high',
    avgPriceUsd: 45,
    saturation: 0.56,
    baseGrowth: 13,
    demandIndex: 83,
  },
  {
    slug: 'coffee-craft',
    name: 'Coffee Craft',
    category: 'Food & Grocery',
    description:
      'Café-at-home: portable espresso makers, precision grinders, cold brew gear and scales.',
    keywords: ['portable espresso maker', 'coffee grinder', 'cold brew maker', 'coffee scale'],
    marginBand: 'mid',
    avgPriceUsd: 47,
    saturation: 0.45,
    baseGrowth: 16,
    demandIndex: 78,
  },
  {
    slug: 'hair-styling',
    name: 'Hair Styling',
    category: 'Health & Beauty',
    description:
      'Salon hair at home: straightening brushes, curling wands, hot-air dryers and scalp tools.',
    keywords: ['hair straightener brush', 'curling wand', 'hot air brush', 'scalp massager'],
    marginBand: 'high',
    avgPriceUsd: 58,
    saturation: 0.54,
    baseGrowth: 19,
    demandIndex: 87,
  },
  {
    slug: 'gaming-accessories',
    name: 'Gaming Accessories',
    category: 'Electronics',
    description:
      'Desk-setup gaming gear: RGB mats, headset stands, controller chargers and capture cams.',
    keywords: ['rgb mouse pad', 'headset stand', 'controller charger', 'capture card'],
    marginBand: 'low',
    avgPriceUsd: 36,
    saturation: 0.63,
    baseGrowth: 10,
    demandIndex: 80,
  },
  {
    slug: 'home-cleaning',
    name: 'Home Cleaning Gadgets',
    category: 'Home & Kitchen',
    description:
      'Effortless cleaning: electric mops, window vacuums, handheld steamers and lint gadgets.',
    keywords: ['electric mop', 'window vacuum', 'handheld steamer', 'lint remover'],
    marginBand: 'mid',
    avgPriceUsd: 44,
    saturation: 0.49,
    baseGrowth: 14,
    demandIndex: 76,
  },
  {
    slug: 'smart-home-devices',
    name: 'Smart Home Devices',
    category: 'Home & Living',
    description:
      'Apartment-smart kit: smart plugs, video doorbells, motion sensors and leak alarms.',
    keywords: ['smart plug', 'video doorbell', 'motion sensor', 'water leak detector'],
    marginBand: 'high',
    avgPriceUsd: 39,
    saturation: 0.51,
    baseGrowth: 17,
    demandIndex: 82,
  },
  {
    slug: 'fitness-tracking',
    name: 'Fitness Tracking',
    category: 'Sports & Outdoors',
    description:
      'Track-everything fitness: smart jump ropes, body-fat scales, resistance gear and rollers.',
    keywords: ['smart jump rope', 'body fat scale', 'resistance bands', 'foam roller'],
    marginBand: 'mid',
    avgPriceUsd: 37,
    saturation: 0.57,
    baseGrowth: 12,
    demandIndex: 81,
  },
];

const PRODUCT_TITLES: Record<string, string[]> = {
  'portable-kitchen': [
    'USB-C Portable Blender, 6-Blade Smoothie Cup',
    'Electric Heated Lunch Box, 2-Tier',
    'Cordless Milk Frother with Stand',
    'Mini Rice Cooker 1.2L, One-Pot Meals',
    'Rechargeable Citrus Juicer To-Go',
    'Vacuum Food Sealer, Compact Roll Set',
  ],
  'recovery-wellness': [
    'Percussive Massage Gun, 6 Heads',
    'Acupressure Mat & Pillow Set',
    'Red Light Therapy Face Mask, 7 LEDs',
    'Posture Corrector Bra, Adjustable',
    'Heated Neck & Shoulder Wrap',
    'Electric Scalp Massager, 4 Modes',
  ],
  'pet-tech': [
    'Rechargeable LED Dog Collar, Glow Mode',
    '2-in-1 Pet Hair Remover Roller',
    'Automatic Cat Feeder, 4L Timed',
    'GPS Pet Tracker, No Subscription',
    'Silent Dog Nail Grinder, USB',
    'Interactive Cat Ball, Motion Sensor',
  ],
  'ambient-lighting': [
    'Sunset Lamp Projector, 16 Colors',
    'Galaxy Star Projector, Remote',
    'LED Strip Lights 32.8ft, App Control',
    'Rotating Ocean Wave Projector',
    'Neon Flex Sign, Custom Text',
    'Mushroom Table Lamp, Dimmable',
  ],
  'mobile-workstation': [
    'Mini Projector 1080P, Portable',
    'Portable Monitor 15.6" USB-C',
    'Ergonomic Mechanical Keyboard, 75%',
    'Aluminum Laptop Stand, Foldable',
    'Wireless Number Pad, Slim',
    'Webcam Light Ring, Clip-On',
  ],
  'car-essentials': [
    'Cordless Car Vacuum, 12000Pa',
    'Car Seat Organizer, Backseat',
    'Headrest Phone Mount, 360°',
    'Digital Tire Inflator, Auto-Stop',
    'Dash Cam Front & Cabin, 4K',
    'Trunk Organizer, Collapsible',
  ],
  'outdoor-comfort': [
    'Heated Vest, USB-C Powered',
    'Rapid Cooling Towel, 2-Pack',
    'Portable Hammock with Mosquito Net',
    'Rechargeable Camping Lantern',
    'Foldable Water Bottle, 1L',
    'Emergency Sleeping Bag 2-Pack',
  ],
  'hydration-smart': [
    'Smart Water Bottle, Glow Reminder',
    'Insulated Tumbler 40oz, Straw Lid',
    'UV Water Purifier Cap',
    'Bottle with Time Markings, 1L',
    'Collapsible Water Bottle, Silicone',
    'Fruit Infuser Bottle, Leakproof',
  ],
  'beauty-devices': [
    'LED Face Mask, 7-Color Therapy',
    'Microcurrent Facial Device',
    'Scalp Massager Shampoo Brush',
    'UV Nail Lamp, 48W Sensor',
    'Dermaplane Tool Set, 5 PCS',
    'Heated Eyelash Curler, USB',
  ],
  'kids-stem-play': [
    'Magnetic Building Blocks, 120 PCS',
    'Kids Digital Camera, 1080P',
    'Montessori Shape Sorter Set',
    'Science Experiment Kit, 50+',
    'Glow-in-Dark Dinosaur Set',
    'Wooden Balance Train Puzzle',
  ],
  'desk-aesthetics': [
    'Monitor Light Bar, No Glare',
    'Felt Desk Mat, XL Stitched',
    'Cable Management Box, Large',
    'Mechanical Keyboard, Hot-Swap',
    'Monitor Riser, Bamboo',
    'Magnetic Dock, 8-in-1',
  ],
  'travel-smart': [
    'Compression Packing Cubes, 6 PCS',
    'Anti-Theft Backpack, USB Port',
    'Universal Travel Adapter, 4 USB',
    'Memory Foam Neck Pillow',
    'Luggage Scale, Digital',
    'Toiletry Bag, Hanging Waterproof',
  ],
  'garden-productivity': [
    'Hydroponic Growing Kit, 12 Pods',
    'Self-Watering Planter, Selfie Box',
    'Pruning Shears, Bypass 8"',
    'Soil Moisture Meter, 3-in-1',
    'Plant Grow Light, Full Spectrum',
    'Seed Starter Trays, 6 Pack',
  ],
  'audio-personal': [
    'Open-Ear Headphones, Clip-On',
    'Sleep Headphones, Eye Mask',
    'Voice Recorder, 64GB',
    'Clip-On Mic for Phone',
    'Bone Conduction Headset',
    'Podcast Mic, USB Plug-Play',
  ],
  'baby-essentials': [
    'Bottle Warmer, Fast 4-in-1 Steam',
    'Stroller Organizer with Cup Holders',
    'Baby Nasal Aspirator, Electric',
    'White Noise Machine, 30 Sounds',
    'Diaper Caddy Organizer, Portable',
    'Baby Nail Trimmer Kit, Quiet',
  ],
  'craft-stationery': [
    'Sticker Printer, Bluetooth Mini',
    'Heat Transfer Pen, Crafting Kit',
    'Calligraphy Pen Set, 12 Nibs',
    'Washi Tape Set, 36 Rolls',
    'Cutting Mat, Self-Healing A3',
    'Precision Craft Knife, 30 PCS',
  ],
  'diy-tools': [
    'Electric Screwdriver, 36 PCS',
    'Laser Measure, 131ft Bluetooth',
    'Stud Finder, 4-in-1 Sensor',
    'Mini Cordless Drill, 12V',
    'Digital Caliper, IP54 Waterproof',
    'Magnetic Wristband, 10 Pockets',
  ],
  'creator-gear': [
    'Ring Light 18" with Tripod',
    'Phone Gimbal, 3-Axis Stabilizer',
    'Video Light, Bi-Color Panel',
    'Wireless Lavalier Mic, 2-Pack',
    'Phone Tripod, Flexible Legs',
    'Teleprompter Kit for Phone',
  ],
  'coffee-craft': [
    'Portable Espresso Maker, USB-C',
    'Conical Burr Coffee Grinder',
    'Cold Brew Maker, 1.5L',
    'Coffee Scale, Timer 0.1g',
    'Milk Frother, Rechargeable',
    'Pour-Over Kettle, Gooseneck',
  ],
  'hair-styling': [
    'Hair Straightener Brush, Ionic',
    'Curling Wand, 5-in-1 Barrels',
    'Hot Air Brush, 3-in-1 Dryer',
    'Scalp Massager Shampoo Brush',
    'Hair Clipper Kit, Cordless',
    'Anti-Frizz Straightening Comb',
  ],
  'gaming-accessories': [
    'RGB Mouse Pad, XL Extended',
    'Headset Stand with USB Hub',
    'Controller Charging Dock, 4-Bay',
    'Capture Card, 4K HDMI USB-C',
    'Gaming Grip, Anti-Slip Pair',
    'Cable Sleeve Kit, 10 Pack',
  ],
  'home-cleaning': [
    'Electric Spin Mop, Cordless',
    'Window Vacuum, Streak-Free',
    'Handheld Steamer, 30s Heat',
    'Lint Remover, Rechargeable',
    'Crevice Cleaning Brush Set',
    'Dusting Mop, Static Cloths',
  ],
  'smart-home-devices': [
    'Smart Plug, 4-Pack WiFi',
    'Video Doorbell, 1080P',
    'Motion Sensor, Zigbee',
    'Water Leak Detector, 3-Pack',
    'Smart Light Switch, Dimmer',
    'Indoor Camera, 2K Pan/Tilt',
  ],
  'fitness-tracking': [
    'Smart Jump Rope, App Counting',
    'Body Fat Scale, Bluetooth',
    'Resistance Bands Set, 5 PCS',
    'Foam Roller, Textured 17"',
    'Massage Gun, 6 Heads',
    'Yoga Mat, Non-Slip 6mm',
  ],
};

/** Niche → Amazon/TikTok category affinity used to assign products to niches. */
const SOURCE_CATEGORY_MAP: Record<string, string[]> = {
  'portable-kitchen': ['Home & Kitchen'],
  'recovery-wellness': ['Beauty & Care', 'Sports & Outdoors'],
  'pet-tech': ['Pet Supplies'],
  'ambient-lighting': ['Home & Kitchen', 'Home & Living'],
  'mobile-workstation': ['Electronics'],
  'car-essentials': ['Electronics', 'Home & Kitchen'],
  'outdoor-comfort': ['Sports & Outdoors'],
  'hydration-smart': ['Home & Kitchen', 'Sports & Outdoors'],
  'beauty-devices': ['Beauty & Care'],
  'kids-stem-play': ['Toys & Games'],
  'desk-aesthetics': ['Electronics'],
  'travel-smart': ['Home & Kitchen'],
  'garden-productivity': ['Home & Kitchen'],
  'audio-personal': ['Electronics'],
  'baby-essentials': ['Baby'],
  'craft-stationery': ['Office Products'],
  'diy-tools': ['Tools & Home Improvement'],
  'creator-gear': ['Electronics'],
  'coffee-craft': ['Home & Kitchen'],
  'hair-styling': ['Beauty & Care'],
  'gaming-accessories': ['Electronics'],
  'home-cleaning': ['Home & Kitchen'],
  'smart-home-devices': ['Electronics'],
  'fitness-tracking': ['Sports & Outdoors'],
};

export function nichesFromSeed(now = Date.now()): Niche[] {
  const iso = new Date(now).toISOString();
  return NICHE_SEEDS.map((s, i) => {
    const rnd = mulberry32(hashString(s.slug));
    const noise = (rnd() - 0.5) * 6;
    const wow = Number((s.baseGrowth + noise).toFixed(1));
    const mom = Number((s.baseGrowth * 3.4 + noise * 2).toFixed(1));
    const score = Math.round(
      Math.min(
        99,
        Math.max(
          28,
          s.demandIndex * 0.55 + (1 - s.saturation) * 45 + Math.max(0, wow) * 0.7,
        ),
      ),
    );
    void iso;
    return {
      slug: s.slug,
      name: s.name,
      code: `NX-${String(i + 1).padStart(3, '0')}`,
      category: s.category,
      description: s.description,
      keywords: s.keywords,
      marginBand: s.marginBand,
      avgPriceUsd: s.avgPriceUsd,
      saturation: s.saturation,
      score,
      wowGrowth: wow,
      momGrowth: mom,
      demandIndex: s.demandIndex,
      productCount: PRODUCT_TITLES[s.slug]?.length ?? 0,
    };
  });
}

/** Weekly interest series with a realistic seasonal wobble. */
export function seriesFromSeed(
  keyword: string,
  weeks = 26,
  now = Date.now(),
): SeriesPoint[] {
  const rnd = mulberry32(hashString(keyword));
  const seed = NICHE_SEEDS.find((n) => n.keywords.includes(keyword));
  const growth = seed ? seed.baseGrowth / 100 : 0.1;
  const points: SeriesPoint[] = [];
  let level = 42 + rnd() * 30;
  const end = Math.floor(now / (7 * 86400_000)) * 7 * 86400_000;

  for (let i = weeks - 1; i >= 0; i--) {
    const t = end - i * 7 * 86400_000;
    const trend = 1 + growth / weeks;
    const seasonal = 1 + Math.sin((weeks - i) / 3.4) * 0.11;
    const shock = 1 + (rnd() - 0.5) * 0.14;
    level = level * trend * seasonal * shock;
    const spike = rnd() > 0.94 ? 1.35 : 1;
    points.push({
      t: new Date(t).toISOString(),
      v: Math.max(4, Math.min(100, Math.round(level * spike))),
    });
  }
  // Normalise the last point into 0-100 the way Trends does.
  const max = Math.max(...points.map((p) => p.v), 1);
  return points.map((p) => ({ ...p, v: Math.round((p.v / max) * 100) }));
}

export function productsFromSeed(now = Date.now()): Product[] {
  const out: Product[] = [];
  const iso = new Date(now).toISOString();

  for (const niche of NICHE_SEEDS) {
    const titles = PRODUCT_TITLES[niche.slug] ?? [];
    const rnd = mulberry32(hashString(niche.slug + 'products'));

    titles.forEach((title, idx) => {
      const source = idx % 3 === 0 ? 'amazon' : idx % 3 === 1 ? 'tiktok' : 'google_trends';
      const rank = idx + 1;
      const prevRank = rank + Math.round((rnd() - 0.45) * 5);
      const rankDelta = prevRank - rank;
      const velocity = Number((40 + rnd() * 58).toFixed(1));
      const score = Math.round(
        Math.min(99, 45 + velocity * 0.45 + Math.max(0, rankDelta) * 3 + rnd() * 8),
      );
      const price = Number((niche.avgPriceUsd * (0.6 + rnd() * 0.9)).toFixed(2));

      out.push({
        id: `seed-${niche.slug}-${idx}`,
        nicheSlug: niche.slug,
        title,
        source,
        priceUsd: price,
        rank,
        rankDelta,
        velocity,
        score,
        imageUrl: null,
        url: null,
        metricLabel: source === 'tiktok' ? 'views' : source === 'amazon' ? 'rank Δ' : 'interest',
        metricValue:
          source === 'tiktok'
            ? Math.round(120_000 + rnd() * 4_800_000)
            : source === 'amazon'
              ? rankDelta
              : Math.round(30 + rnd() * 70),
        observedAt: iso,
      });
    });
  }
  return out;
}

export function categoriesForNiche(slug: string): string[] {
  return SOURCE_CATEGORY_MAP[slug] ?? [];
}
