import type { ApiEnvelope } from './types';

const BASE = '/api';

async function get<T>(path: string, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${BASE}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return (await res.json()) as ApiEnvelope<T>;
}

export const api = {
  stats: (signal?: AbortSignal) => get<import('./types').Stats>('/stats', signal),
  niches: (signal?: AbortSignal) => get<import('./types').Niche[]>('/niches', signal),
  niche: (slug: string, signal?: AbortSignal) =>
    get<import('./types').NicheDetail>(`/niches/${encodeURIComponent(slug)}`, signal),
  products: (
    params: { niche?: string; source?: string; sort?: string; limit?: number } = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams();
    if (params.niche) q.set('niche', params.niche);
    if (params.source && params.source !== 'all') q.set('source', params.source);
    if (params.sort) q.set('sort', params.sort);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return get<import('./types').Product[]>(`/products${qs ? `?${qs}` : ''}`, signal);
  },
  trends: (niche?: string, signal?: AbortSignal) =>
    get<import('./types').TrendSeries[]>(`/trends${niche ? `?niche=${encodeURIComponent(niche)}` : ''}`, signal),
  sources: (signal?: AbortSignal) =>
    get<import('./types').SourceHealth[]>('/sources', signal),
  events: (signal?: AbortSignal) =>
    get<import('./types').RefreshEvent[]>('/events', signal),
  refresh: async (source = 'all') => {
    const res = await fetch(`${BASE}/refresh?source=${encodeURIComponent(source)}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
    return res.json() as Promise<{ ok: boolean; ran: string; at: string }>;
  },
};
