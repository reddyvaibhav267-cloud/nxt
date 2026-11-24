import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { api } from './routes/api.js';
import { getDb } from './db/index.js';
import { refreshLog } from './db/repo.js';
import { onRefresh, startScheduler, stopScheduler, refreshers, bootstrapNiches } from './scheduler/refresh.js';
import type { RefreshEvent } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Warm the database before any request can hit it.
getDb();
bootstrapNiches();

/* -------------------------------------------------------------------- SSE */

const sseClients = new Set<express.Response>();

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  // Replay recent refresh history so a client that connects after boot (or
  // reconnects after a drop) immediately shows the last event instead of
  // waiting up to an hour for the next cron tick.
  res.write(
    `event: hello\ndata: ${JSON.stringify({
      at: new Date().toISOString(),
      recent: refreshLog.slice(0, 5),
    })}\n\n`,
  );

  sseClients.add(res);
  const ping = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25_000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
  });
});

function broadcast(ev: RefreshEvent): void {
  const payload = `event: refresh\ndata: ${JSON.stringify(ev)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

onRefresh(broadcast);

/* ------------------------------------------------------------------ routes */

app.use('/api', api);

// Manual refresh — used by the dashboard "sync" button and dev workflows.
// Responds immediately and runs in the background: results are pushed to
// every client over /api/stream, so holding the HTTP connection open for
// the full scrape (40s+) only made the button look frozen.
let refreshInFlight = false;
app.post('/api/refresh', (_req, res) => {
  const which = (_req.query.source as string) || 'all';
  if (refreshInFlight) {
    res.json({ ok: true, ran: 'in-flight', at: new Date().toISOString() });
    return;
  }
  refreshInFlight = true;
  const run = async () => {
    const jobs: Promise<void>[] = [];
    if (which === 'all' || which === 'google_trends') jobs.push(refreshers.refreshGoogleTrends());
    if (which === 'all' || which === 'amazon') jobs.push(refreshers.refreshAmazon());
    if (which === 'all' || which === 'tiktok') jobs.push(refreshers.refreshTikTok());
    await Promise.allSettled(jobs);
  };
  run()
    .catch(() => { /* refreshers emit their own error events */ })
    .finally(() => {
      refreshInFlight = false;
    });
  res.json({ ok: true, ran: which, at: new Date().toISOString() });
});

/* --------------------------------------------------- static client (prod) */

const clientDist = path.resolve(here, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

/* ------------------------------------------------------------------ boot */

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  nxt server  →  http://localhost:${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`  scraping    →  ${config.scrapingEnabled ? 'ENABLED' : 'DISABLED (fallback only)'}`);
  // eslint-disable-next-line no-console
  console.log(
    `  refresh     →  live at boot, then hourly (google :00, amazon :05, tiktok :10)\n`,
  );
  startScheduler();
});

function shutdown(): void {
  stopScheduler();
  for (const c of sseClients) c.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
