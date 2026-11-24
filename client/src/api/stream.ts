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
/** True once we've had a live connection — used to tell first connect from reconnect. */
let hasConnectedBefore = false;

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

function notifyRefresh(ev: RefreshEvent): void {
  setState({ events: [ev, ...state.events].slice(0, 20), lastEventAt: ev.at });
  for (const fn of refreshListeners) {
    try {
      fn(ev);
    } catch {
      /* ignore */
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

  // Server replays recent refresh history in `hello` so a fresh page load
  // shows the last event immediately. On a *re*connect, replayed events may
  // be newer than anything we saw — fire listeners so open dashboards
  // invalidate and catch up on refreshes missed while disconnected.
  es.addEventListener('hello', (e) => {
    try {
      const payload = JSON.parse((e as MessageEvent).data) as {
        at: string;
        recent?: RefreshEvent[];
      };
      const recent = payload.recent ?? [];
      const isReconnect = hasConnectedBefore;
      hasConnectedBefore = true;

      if (recent.length === 0) return;

      const unseen = isReconnect ? recent.slice(0, 1) : [];
      // Display history (newest first) without spamming listeners on first load.
      const merged = [...recent, ...state.events]
        .filter((ev, i, arr) => arr.findIndex((x) => x.at === ev.at && x.source === ev.source) === i)
        .slice(0, 20);
      setState({ events: merged, lastEventAt: merged[0]?.at ?? state.lastEventAt });

      for (const ev of unseen) {
        for (const fn of refreshListeners) {
          try {
            fn(ev);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* malformed payload — ignore */
    }
  });

  es.addEventListener('refresh', (e) => {
    try {
      const ev = JSON.parse((e as MessageEvent).data) as RefreshEvent;
      notifyRefresh(ev);
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
