import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
  locale: 'en-US',
});
const page = await context.newPage();

const captured = [];

page.on('request', (req) => {
  const url = req.url();
  if (url.includes('cloudfront.net') && url.includes('/entries?')) {
    captured.push({ url, headers: req.headers() });
  }
});

const pages = [
  'https://visa.vfsglobal.com/ind/en/deu/',
  'https://visa.vfsglobal.com/ind/en/deu/apply-visa',
];
for (const u of pages) {
  try {
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(7000);
  } catch (e) { console.log('warn', u, e.message); }
}

console.log('Total entries API requests captured:', captured.length);
if (captured.length) {
  // Show the headers of the first one (they all share the same auth scheme)
  console.log('\n=== EXAMPLE REQUEST HEADERS ===');
  console.log(JSON.stringify(captured[0].headers, null, 2));
  console.log('\n=== ALL content_types seen ===');
  captured.forEach((c) => {
    const m = c.url.match(/content_type=([^&]+)/);
    console.log('  -', m ? m[1] : '?');
  });
}

await browser.close();
