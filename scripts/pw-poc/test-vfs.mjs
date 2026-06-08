import { chromium } from 'playwright';

const URL = 'https://visa.vfsglobal.com/ind/en/deu/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
  locale: 'en-US',
});
const page = await context.newPage();

console.log('Navigating to', URL);
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
} catch (e) {
  console.log('goto warning:', e.message);
}

// Give JS + any Cloudflare challenge time to settle
await page.waitForTimeout(8000);

const title = await page.title();
const bodyText = await page.evaluate(() => document.body?.innerText || '');

console.log('=== PAGE TITLE ===');
console.log(title);
console.log('=== BODY LENGTH ===', bodyText.length);

// Cloudflare detection
const cf = /just a moment|checking your browser|cloudflare|verify you are human/i.test(
  title + ' ' + bodyText.slice(0, 1000),
);
console.log('=== CLOUDFLARE BLOCK? ===', cf ? 'YES — blocked' : 'no');

// Keyword scan for the data we actually need
const keywords = ['fee', '€', 'euro', '90', 'document', 'passport', 'application centre', 'service charge'];
console.log('=== KEYWORD SCAN ===');
for (const k of keywords) {
  const matches = bodyText.match(new RegExp(k, 'gi'));
  console.log(`  "${k}": ${matches ? matches.length + ' matches' : 'NONE'}`);
}

console.log('=== FIRST 800 CHARS OF VISIBLE TEXT ===');
console.log(bodyText.slice(0, 800));

await page.screenshot({ path: 'vfs-render.png', fullPage: false });
console.log('=== screenshot saved: vfs-render.png ===');

await browser.close();
