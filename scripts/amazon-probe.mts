import * as cheerio from 'cheerio';
import { getText } from '../server/src/lib/http.ts';

const html = await getText(
  'https://www.amazon.com/Best-Sellers-Kitchen-Appliances/zgbs/kitchen/',
  {
    retries: 2,
    timeoutMs: 20000,
    headers: {
      Referer: 'https://www.amazon.com/',
      'Accept-Language': 'en-US,en;q=0.9',
      Cookie: 'i18n-prefs=USD; lc-main=en_US',
    },
  },
);

const $ = cheerio.load(html);
$('.zg-grid-general-faceout .a-price')
  .slice(0, 5)
  .each((_, e) => {
    const p = $(e);
    console.log({
      offscreen: p.find('.a-offscreen').text(),
      symbol: p.find('.a-price-symbol').text(),
      whole: p.find('.a-price-whole').text(),
      decimal: p.find('.a-price-decimal').text(),
      fraction: p.find('.a-price-fraction').text(),
      raw: p.text().replace(/\s+/g, ' '),
    });
  });
