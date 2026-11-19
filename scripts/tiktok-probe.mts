import { postJson } from '../server/src/lib/http.ts';

const ENDPOINT =
  'https://ads.us.tiktok.com/CreativeOne/Report/CreativeCenterGetTopContentsList';

const started = Date.now();
try {
  const res = await postJson<Record<string, unknown>>(
    ENDPOINT,
    {
      page: 1,
      limit: 20,
      sortType: 0,
      contentType: 0,
      countryCode: 'US',
      period: 7,
    },
    {
      retries: 1,
      timeoutMs: 12_000,
      headers: {
        Origin: 'https://ads.tiktok.com',
        Referer: 'https://ads.tiktok.com/creative/creativeCenter/trends',
        'agw-js-conv': '1',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      },
    },
  );
  console.log('OK in', Date.now() - started, 'ms');
  console.log('top-level keys:', Object.keys(res));
  console.log('code:', res.code, 'msg:', res.msg);
  console.log('data type:', typeof res.data, Array.isArray(res.data) ? 'array' : '');
  console.log(JSON.stringify(res).slice(0, 1500));
} catch (e) {
  console.log('FAIL in', Date.now() - started, 'ms:', (e as Error).message);
}
