import type { RefreshEvent } from './types';

export interface StreamState {
  events: RefreshEvent[];
  connected: boolean;
  lastEventAt: string | null;
}

/**
 * Shared singleton SSE stream. One EventSource for the whole app; components
 * subscribe through useRefreshStream, and main.tsx listens for refresh events
 * to invalidate react-query caches (so open dashboards auto-update).
 */
let es: EventSource | null = null;
const stateListeners = new Set<() => void>();
const refreshListeners = new Set<(ev: RefreshEvent) => void>();
let state: StreamState = { events: [], connected: false, lastEventAt: null };

function setState(patch: Partial<StreamState>): void {
  state = { ...state, ...patch };
  for (const fn of stateListeners) {
    try {
      fn();
    } catch {
      /* listener errors must not break the stream */
    }
  }
}

function ensureStream(): void {
  if (es !== null || typeof EventSource === 'undefined') return;
  es = new EventSource('/api/stream');

  es.onopen = () => {
    if (!state.connected) setState({ connected: true });
  };
  es.onerror = () => {
    // EventSource reconnects on its own; only publish real transitions.
    if (state.connected) setState({ connected: false });
  };

  es.addEventListener('refresh', (e) => {
    try {
      const ev = JSON.parse((e as MessageEvent).data) as RefreshEvent;
      setState({ events: [ev, ...state.events].slice(0, 20), lastEventAt: ev.at });
      for (const fn of refreshListeners) {
        try {
          fn(ev);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* malformed payload — ignore */
    }
  });
}

export function subscribeStream(fn: () => void): () => void {
  ensureStream();
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

/** Fires only on server refresh events (not on connect/disconnect). */
export function onRefreshEvent(fn: (ev: RefreshEvent) => void): () => void {
  ensureStream();
  refreshListeners.add(fn);
  return () => refreshListeners.delete(fn);
}

export function getStreamState(): StreamState {
  return state;
}
