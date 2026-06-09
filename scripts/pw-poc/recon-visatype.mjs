import { chromium } from 'playwright';

const URL = 'https://visa.vfsglobal.com/ind/en/pol/visa-type';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
  locale: 'en-US',
});
const page = await context.newPage();

const hits = [];
page.on('response', async (res) => {
  const url = res.url();
  const ct = res.headers()['content-type'] || '';
  if (!ct.includes('application/json')) return;
  if (!url.includes('cloudfront.net') && !url.includes('ctfassets') && !url.includes('contentful')) return;
  try {
    const text = await res.text();
    if (text.length < 200) return;
    const ctype = (url.match(/content_type=([^&]+)/) || [])[1] || 'n/a';
    // Flag interesting payloads
    const flags = [];
    if (/service charge|service fee/i.test(text)) flags.push('SERVICE_CHARGE');
    if (/9504|1026|visa fee in inr|fee in euro/i.test(text)) flags.push('FEES');
    if (/business visit|short-term visa|visa type|visaType/i.test(text)) flags.push('VISA_TYPES');
    if (/checklist|\.pdf/i.test(text)) flags.push('CHECKLIST_PDF');
    if (/processing time|photo spec|application form/i.test(text)) flags.push('OTHER_TABS');
    hits.push({ url, ctype, len: text.length, flags });
    // Save the most promising payloads to disk for deep inspection
    if (flags.length >= 2) {
      const fname = `recon_${ctype}_${hits.length}.json`;
      const fs = await import('fs');
      fs.writeFileSync(fname, text);
    }
  } catch {}
});

console.log('Loading visa-type page...');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto:', e.message));
await page.waitForTimeout(9000);

// Try to select a visa type from the dropdown to trigger any extra loads
try {
  const selects = await page.$$('select');
  console.log('dropdowns found:', selects.length);
  if (selects.length) {
    const options = await selects[0].$$eval('option', (els) => els.map((e) => e.textContent?.trim()));
    console.log('visa type options:', JSON.stringify(options));
    // pick the first real option
    const real = options.find((o) => o && !/select|please/i.test(o));
    if (real) {
      await selects[0].selectOption({ label: real });
      await page.waitForTimeout(5000);
      console.log('selected:', real);
    }
  }
} catch (e) {
  console.log('dropdown interaction:', e.message);
}

console.log('\n=== CONTENTFUL/ASSET JSON RESPONSES ===');
for (const h of hits) {
  console.log(`• ${h.ctype} | ${h.len}b | flags: ${h.flags.join(',') || 'none'}`);
  console.log(`  ${h.url.slice(0, 130)}`);
}

await browser.close();
