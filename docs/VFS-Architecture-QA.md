# VFS Schengen Platform — Architecture Q&A

> A plain-language reference covering how the crawler works, why it's built on the
> Contentful API, and what data it pulls. Compiled from a working session on
> 2026-06-12.

---

## Q1. India → Latvia showed no data. What was the root cause?

Four separate bugs, all now fixed:

1. **"Incomplete" threshold too strict** — the Contentful parser required ≥15 linked
   entries before accepting a response. Latvia's simple Airport Transit page has fewer,
   so valid data was rejected. Lowered to 3.
2. **Service-charge format not matched** — the regex didn't recognise `"Rs. 2987/-"`.
   Added it to both parsers.
3. **No fallback source** — when a country lacks a standalone `onePager` entry, the code
   now falls back to the `countryPage` content type (the same source the VFS site uses).
4. **Route never crawled** — Latvia wasn't in the recrawl list. The script now
   pre-creates all 29 Schengen routes before crawling.

**Result:** Latvia now returns 12 visa types, €90 / ₹9,956 fees, ₹2,987 service charge.

---

## Q2. Give me SQL to wipe all stored data and test from scratch. Good idea?

**The SQL** (run in Supabase SQL Editor — children first, then routes):

```sql
BEGIN;
DELETE FROM visa_type_fees;
DELETE FROM visa_type_documents;
DELETE FROM visa_types;
DELETE FROM visa_fee_history;
DELETE FROM visa_documents;
DELETE FROM visa_requirements;
DELETE FROM travel_advisories;
DELETE FROM source_records;
DELETE FROM change_logs;     -- no CASCADE → must be explicit
DELETE FROM vac_centers;     -- keyed by country, not route_id
DELETE FROM visa_routes;     -- parent last
COMMIT;
```

**Never delete:** `countries` (holds the BG/RO Schengen flags + FK target) and `users`.

**After wiping:** restart the backend (clears the in-memory in-flight lock) and flush
Redis (`docker exec schengen-redis redis-cli FLUSHALL`).

**Honest verdict:** The instinct is right, the method is heavier than needed. There is
**no stale-cache layer** — the API reads Supabase live every request. So a lighter,
sharper test proves freshness better:

```sql
-- Poison one route, then recrawl it and watch it self-correct
UPDATE visa_requirements SET service_fee = 99999
WHERE route_id = (SELECT id FROM visa_routes
                  WHERE origin_country='IN' AND destination_country='LV');
```
Then `POST /api/routes/IN/LV/recrawl`. If it comes back ₹2,987, the crawler genuinely
fetched from VFS. The full wipe is only worth it for a deliberate cold-start test.

---

## Q3. What is Contentful and how does it work?

Contentful is a **headless CMS** — it stores *content only* (text, numbers, tables) and
hands it out as **JSON via an API**. It has no front-end ("headless").

- **Analogy:** Contentful is the *warehouse* of labelled content boxes; the website is
  the *shop* that requests boxes and arranges them on shelves.
- **VFS uses it** so its JavaScript site can fetch visa data and assemble each page in
  the browser.
- **We exploit it** by calling the same API the site calls — getting clean JSON directly
  instead of scraping rendered HTML.

Key terms: **content type** (kind of box, e.g. `countryPage`), **entry** (one box),
**locale** (the routing key `{dest3} > {orig3} > en`), **include** (also fetch linked
boxes, up to 10 deep).

---

## Q4. Are we actually using Contentful? How is data fetched?

Yes — it's the **primary source**. Three files in `backend/src/modules/vfs/`:

| File | Job |
|---|---|
| `vfs-token.service.ts` | Holds & self-heals the access token |
| `vfs-contentful.service.ts` | Fetches VAC centres + fee/document text |
| `vfs-visatype.service.ts` | Fetches per-visa-type data (fees, charges, checklists) |

Each call is a plain `axios` GET to the CloudFront-cached endpoint with the locale param
and `Authorization: Bearer <token>`.

**Standout feature — the token self-heals:** when a call returns `401`, the code launches
a headless Chromium (Playwright), loads a real VFS page, and **eavesdrops on the network
requests** to capture a fresh `Bearer` token automatically. No manual updates needed.

---

## Q5. The bearer token is exposed — isn't that a security bug? + curl for Postman

It's a **public read-only Delivery token** — VFS embeds it in their site on purpose so
browsers can read published content. It **cannot write or delete** anything. So it's not
a breach risk; at most VFS may rotate it (our code self-heals when they do).

**Working curl (India → Latvia visa types):**
```bash
curl --location 'https://d2ab400qlgxn2g.cloudfront.net/dev/spaces/xxg4p8gt3sg6/environments/master/entries?content_type=onePager&fields.name=lva%20%3E%20ind%20%3E%20en&include=10' \
  --header 'Authorization: Bearer 5YpTBRikGN59YHwM18CyGr5F43bFuaak9U8FSMEDmb8' \
  --header 'Referer: https://visa.vfsglobal.com/'
```
Locale encoding: `lva > ind > en` → `lva%20%3E%20ind%20%3E%20en` (space=`%20`, `>`=`%3E`).
Other routes: swap `{dest3} > {orig3} > en` (e.g. `dnk > ind > en`).

---

## Q6. What's the equivalent POST API for this?

**There isn't one — this is a GET-only read API.** Changing it to POST returns 404/405.
In Contentful, POST means only:
- **GraphQL** (`graphql.contentful.com/...`) — a different URL, needs the exact schema.
- **Management API** (`api.contentful.com/...`) — for *writing*, needs a secret token VFS
  does **not** expose. Not usable.

**Recommendation:** stick with the GET — it's cached, fast, and exactly what VFS uses.

---

## Q7. Why can't we just scrape the VFS website? (the "SPA" reason)

VFS is a **Single Page Application (SPA)** — not the old "JSP". The server sends a nearly
**empty shell** (`<div id="app"></div>` + JavaScript). The visa data only appears *after*
the browser runs that JavaScript, which fetches it from Contentful.

- **Analogy:** old sites arrive like a cooked pizza; an SPA arrives like an IKEA flat-pack
  the browser assembles.
- A normal scraper grabs the raw response (the empty shell) and never runs the JavaScript,
  so it sees **no data**.
- On top of that, VFS sits behind **Cloudflare**, which blocks bots (returns 403).

**Solution:** skip the page entirely and call the same Contentful API the JavaScript uses.

---

## Q8. Show the empty shell vs Contentful (live proof) — India → Latvia

| | Raw VFS page (scraping) | Contentful API |
|---|---|---|
| HTTP status | ❌ 403 (Cloudflare blocked) | ✅ 200 |
| Size | 43 bytes (`{"code":"403201"}`) | ~135 KB |
| "9956" (fee) | 0 times | 10 times |
| "2987" (service charge) | 0 times | 11 times |
| Real content | none | 31 data boxes + 12 PDFs |

The raw page literally contains zero visa data; Contentful contains all of it.

---

## Q9. How much can we scrape via the Contentful API? (the ceiling)

It's VFS's **entire global CMS**, not just India:

| Metric | Number |
|---|---|
| Total entries in the space | **186,809** |
| Content types (kinds of data) | **72** |
| Origin countries served | **109** (China, Russia, India, UAE, …) |
| `onePager` visa-type pages | 1,918 |
| `countryPage` (fees/docs) | 15,024 |
| `countryLocation` (VAC centres) | 7,807 |

We currently use India → ~24 Schengen routes ≈ **under 1%** of what's reachable.

**Valuable unused content types:** `countryNewsflash` (532 — live alerts → Travel
Advisories), `valueAddedService` (16,582 — optional service fees), `countryAccordionSteps`
(12,558 — process guides), `countryNews` (10,470).

**Practical limits:** 1,000 entries per call (paginate), throttling risk (`429` if too
fast), `include` depth max 10, token rotation.

---

## Q10. For India → Latvia, can Contentful give ALL the route data?

**All the *content*: yes. The live/transactional stuff: no.**

✅ **Available (content):** 12 visa types, every fee (EUR + INR), ₹2,987 service charge,
12 VAC centres (GPS/hours/maps), 12 checklist PDFs, full requirements text, and 7 unused
value-added services.

⚪ **Returned 0 (not a limitation):** `countryNews` / `countryNewsflash` for Latvia — VFS
just hasn't published any for that route yet.

❌ **Not in Contentful at all (cannot scrape):** live appointment slots, application status
tracking, payments, biometric specifics. These are **dynamic + personalised** and live in
a separate booking backend, not the CMS.

**Mental model:** everything VFS *publishes* about the route = yes; everything VFS
*processes* for an individual applicant = no.

---

## Q11. Does Gemini receive all VFS data and organise it, or does Contentful give the fields directly?

**Gemini does NOT get all the data.** Three paths:

1. **Direct parse (no AI)** — the majority. Code reads JSON/HTML straight into the DB:
   VAC centres, visa types, fee tables (EUR/INR), VFS service charge, checklist PDFs,
   application links.
2. **Gemini (AI) — text only** — receives just **two free-text blocks** from `countryPage`
   (fee prose + "what to bring" prose, ~14k chars each) and turns them into structured
   fields: `visa_fee`, `currency`, `service_fee`, `processing_time_min/max`,
   `insurance_*`, `vaccination_*`, `passport_validity`, `eligibility_notes`, `documents[]`.
3. **Fallback (no AI)** — Schengen standard (€90, 12 docs) when Contentful is empty.

**Twist:** even some Visa-Overview fields Gemini extracts (service fee, processing time)
get **overridden** afterward by the cleanly-parsed values from the visa-type data, because
the structured parse is more reliable.

**Why the split:** structured data (tables, GPS) → parse directly (deterministic, no
hallucination); messy prose → Gemini (LLMs are good at unstructured text).

**One line:** Contentful does the heavy lifting structurally; Gemini is a small, targeted
helper for messy text only.

---

## Q12. What input/code do we feed Contentful? What if VFS uses a different code?

**The translation layer.** The app URL carries ISO alpha-2 codes; Contentful uses ISO
alpha-3 in a specific format. We translate:

```
App URL:        /route/IN/LV
ISO2_TO_ISO3:      IN→ind   LV→lva        (hardcoded map in common/iso-codes.ts)
Built string:   "lva > ind > en"          ← {destination3} > {origin3} > en
Contentful:     fields.name = "lva > ind > en"   (EXACT match)
```

So the input is a **guessed string** assembled from a fixed code table, matched exactly
against `fields.name`.

**The problem this question uncovered — VFS does NOT always use that format.** Live example
for Italy:

| Query | Result |
|---|---|
| Our code: `fields.name = ita > ind > en` | **0 matches** ❌ |
| Robust: `fields.targetCountry=ita` + `sourceCountry=ind` | **22 matches** ✅ (incl. `language=en`) |

Italy's data exists, but VFS stores it as `'ita > ind > it > bangalore'` (different language
`it`, an extra **city** segment) and most entries have a **null `name`** — identified only by
the structured fields `targetCountry`/`sourceCountry`/`language`. **This is why Italy, France,
Germany, Belgium, Iceland show 0 visa types** — not missing data, just a query that can't
find it.

**How it works now:** build `{dest3} > {orig3} > en`, exact-match `fields.name`. Works for
~20 countries using the clean format; for anything non-standard → 0 results → **silent
fallback** to €90 standard data.

**The robust fix (discover, don't guess):** query by the always-reliable structured fields
`fields.sourceCountry` + `fields.targetCountry`, then prefer `language=en` and pick the best
entry. These are populated even when `name` is null, so they find the entries the
name-match misses. Principle: **stop guessing the key — ask Contentful what it has for this
origin→destination and pick from the answer.**

### Plain-language version (the filing-cabinet analogy)

Contentful is a filing cabinet of visa folders. Each folder can be found two ways: by a
**handwritten label on the front** (`name`) or by **two fixed tags inside** — a FROM tag
(`sourceCountry`) and a TO tag (`targetCountry`). Our code only searched by the label. VFS
was sloppy with labels — Italy's folders have no label (or a weird one like
`ita > ind > it > bangalore`), so the label search found nothing even though 22 Italy
folders were sitting right there. The fix: search by the FROM/TO tags (always present,
never misspelled) and pick the English folder. The working countries are unaffected
because their folders have both a label *and* the tags.

### Implemented as a 3-attempt cascade (safe — nobody loses)

`fetchVisaTypes()` in `vfs-visatype.service.ts` now tries, in order:
1. **Exact `name` match** — fast path, unchanged for the ~20 working countries.
2. **Structured-field lookup** — `sourceCountry` + `targetCountry` + `language=en`. Rescues
   Italy/France/Germany/Belgium/Iceland whose `name` is null/non-standard.
3. **`countryPage` fallback** — last resort.

**Verified before building:** Italy's English entry, fetched by structured fields, contains
**17 fee tables** + the visa-type dropdown (sample row: `C Schengen → ₹9,630 / €90`). So the
data was always present; only the lookup was wrong.

### Result after deploying (recovered countries)

| Route | Before | After | Notes |
|---|---|---|---|
| IN→IT | 0 | **21 types** (18 with fees) | full recovery |
| IN→IS | 0 | **5 types** (5 with fees) | full recovery |
| IN→DE | 0 | **3 types** (2 with fees) | recovered |
| IN→BE | 0 | **2 types** (2 with fees) | recovered |
| IN→FR | 0 | **1 type** (0 fees) | see code-alias note below |

Regression check passed: LV (12), BG (8), DK (8) unchanged.

### Edge case: non-standard VFS target codes (France)

France was *still* 0 after the structured fix — because VFS files France-from-India under
its **own sub-code `frp`**, not the ISO3 `fra` (`fra<-ind` = 0 entries; `frp<-ind` = 1).
Added a `VFS_TARGET_ALIASES` map (`fra → frp`); Attempt 2 tries the standard ISO3 first,
then known aliases. France is the only Schengen country needing this; its onePager has the
visa-type dropdown but **no per-type fee tables**, so it shows visa types + the €90 overview
but no per-type fees (that's all VFS publishes for it). More aliases can be added to the map
if other routes surface the same quirk.

### Clearing up two common misconceptions about this fix

**Misconception 1: "We removed country codes."** No — we still use codes. The FROM/TO
tags *are* country codes (`sourceCountry=ind`, `targetCountry=lva`). What changed is *how*
we search with them:

| | Old way | New way |
|---|---|---|
| What we send | one glued string `"lva > ind > en"` | two separate tags `sourceCountry=ind`, `targetCountry=lva` |
| Match type | **exact** (whole label must match) | **field-based** (works even if the label is blank/odd) |

The codes never went away — we stopped gluing them into one fragile label and started
using them as two separate, reliable filters.

**Misconception 2: "We get a URL, then go scrape it."** No — it's **one call, not two**.
The structured query both *finds* the entry and *delivers* all its data in the same
response (because we pass `include=10`):

```
Ask:    "entry where FROM=ind, TO=lva, en — AND include all its linked data"
Reply:  the matching entry + ALL its visa data (fees, types, PDFs) in ONE response
```

There's no second step, no URL we extract and re-fetch. The JSON that returns already
contains everything; we just read it. (Also: the FROM/TO tags aren't on the *visible* VFS
web page — they're fields inside the Contentful backend entry the page pulls from.)

**One-paragraph version:** Instead of guessing one exact label like `lva > ind > en`
(which VFS sometimes didn't write), we ask Contentful "find the entry tagged FROM=India,
TO=Latvia, in English, and send me all its linked data." It returns the matching entry
with all the visa data in a single response. Codes stay — they're just the two search tags
now, not a glued string — and find + fetch happen together in one call.

---

## Q13. Why did India→Italy show "Service Fee N/A" when VFS publishes it?

**Two separate things, only one was a bug:**

1. **Visa fees were fine** — Italy has all 21 visa types with fees (Tourist €90/₹9,630,
   etc.). The earlier "missing" appearance was a *mid-crawl screenshot* (the page was viewed
   while a recrawl was still running). The data was complete once the crawl finished.

2. **Service fee was a real parsing bug.** Italy stores it as:
   `"VFS Service Charge (inclusive of GST –SGST @9% and CGST@9%), of INR 631"`.
   Our regex expected the amount *immediately* after "service charge" (like Latvia's
   "service charge of Rs. 2987"). The GST **parenthetical between** the keyword and the
   amount made the match fail → N/A.

**Fix:** both parsers now allow a **bounded gap** (`service charge … of INR 631`) between the
keyword and the amount, then take the first currency amount that follows. Verified: Italy
→ ₹631, Latvia → ₹2,987 (unchanged), Poland/Netherlands/Sweden all still parse.

**Note — it was NOT "a different page".** Everything for Italy was in the `onePager` we
already fetch; the only issue was the *text format* of the service-charge sentence.

---

## Reference: the per-route data flow

```
crawlRoute(IN, LV)
  ├─ VfsContentfulService.fetchRouteData()   → VAC centres + fee/doc TEXT
  │     └─ Gemini extracts JSON from the TEXT → visa_requirements + visa_documents
  ├─ VfsVisaTypeService.fetchVisaTypes()      → onePager → countryPage fallback
  │     +  static one-pager HTML (second source)
  │     └─ merge by quality → visa_types + visa_type_fees   (no AI)
  └─ token 401? → Playwright captures a fresh one and retries
```

**Coverage signal:** `confidence_level='high' + vac_centers>0` = real VFS scrape;
`confidence_level='medium' + vac_centers=0` = standard fallback (RO, GR, ES, LI).
