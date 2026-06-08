import { chromium } from 'playwright';

// Pages to visit — landing, apply (fees/docs), attend-centre (docs), find a centre (VACs)
const PAGES = [
  'https://visa.vfsglobal.com/ind/en/deu/',
  'https://visa.vfsglobal.com/ind/en/deu/apply-visa',
  'https://visa.vfsglobal.com/ind/en/deu/attend-centre',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
  locale: 'en-US',
});
const page = await context.newPage();

const apiHits = [];

page.on('response', async (response) => {
  const url = response.url();
  const ct = response.headers()['content-type'] || '';
  // Only look at JSON API responses (skip images/css/js bundles)
  if (!ct.includes('application/json')) return;
  if (url.includes('.png') || url.includes('.svg')) return;
  try {
    const text = await response.text();
    // Does this response contain the data we care about?
    const hasData = /fee|document|passport|centre|center|address|euro|charge|amount/i.test(text);
    if (hasData && text.length > 200) {
      apiHits.push({ url, length: text.length, sample: text.slice(0, 300) });
    }
  } catch {}
});

for (const url of PAGES) {
  console.log('\n>>> Visiting:', url);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(7000);
  } catch (e) {
    console.log('  warn:', e.message);
  }
}

console.log('\n================ JSON API responses containing useful data ================');
console.log('Total relevant API hits:', apiHits.length);
for (const hit of apiHits.slice(0, 25)) {
  console.log('\n• URL:', hit.url);
  console.log('  size:', hit.length, 'bytes');
  console.log('  sample:', hit.sample.replace(/\s+/g, ' ').slice(0, 220));
}

await browser.close();
