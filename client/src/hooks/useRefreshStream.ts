import { useSyncExternalStore } from 'react';
import { getStreamState, subscribeStream, type StreamState } from '../api/stream';

/**
 * Shared SSE subscription: live refresh events + connection state.
 * Backed by a single app-wide EventSource (see api/stream.ts).
 */
export function useRefreshStream(): StreamState {
  return useSyncExternalStore(subscribeStream, getStreamState, getStreamState);
}
