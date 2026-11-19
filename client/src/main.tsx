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
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
onRefreshEvent(() => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    for (const key of ['stats', 'niches', 'niche', 'products', 'sources']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, 800);
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
