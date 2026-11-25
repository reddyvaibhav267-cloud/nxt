import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { onRefreshEvent } from './api/stream';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

// Auto-refresh the feed: every server refresh event invalidates cached data so
// open pages update without a reload. Debounced because sources emit in bursts.
// invalidateQueries marks matching keys stale; refetchQueries forces an immediate
// network round-trip so "refresh now" and cron ticks always hit the server.
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
onRefreshEvent(() => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    const keys = ['stats', 'niches', 'niche', 'products', 'sources'] as const;
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
    void queryClient.refetchQueries({ queryKey: ['stats'] });
    void queryClient.refetchQueries({ queryKey: ['niches'] });
    void queryClient.refetchQueries({ queryKey: ['sources'] });
  }, 400);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
