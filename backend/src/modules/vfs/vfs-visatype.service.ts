import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISO2_TO_ISO3 } from '../../common/iso-codes';
import { VfsTokenService } from './vfs-token.service';

// VFS sometimes files a destination under its own internal sub-code instead of
// the ISO-3166 alpha-3. Known Schengen case: France (from India) lives under
// "frp", not "fra". When the standard code finds nothing, we also try these.
const VFS_TARGET_ALIASES: Record<string, string[]> = {
  fra: ['frp'], // France
};

export interface VfsFeeRow {
  label: string;
  inr: number | null;
  eur: number | null;
}

export interface VfsVisaType {
  category: string; // 'Schengen Visa' | 'National Visa' | etc.
  name: string; // 'Business Visit'
  fees: VfsFeeRow[];
  service_fee: number | null;
  service_fee_currency: string | null;
  service_fee_note: string | null;
  checklist_pdf_url: string | null;
  checklist_name: string | null;
  application_form_url: string | null;
  processing_time: string | null;
  photo_specifications: string | null;
  overview: string | null;
}

@Injectable()
export class VfsVisaTypeService {
  private readonly logger = new Logger(VfsVisaTypeService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: VfsTokenService,
  ) {
    this.baseUrl =
      this.configService.get<string>('CONTENTFUL_BASE_URL') ??
      'https://d2ab400qlgxn2g.cloudfront.net/dev/spaces/xxg4p8gt3sg6/environments/master/entries';
  }

  /** Fetches and parses all visa types (with fees, service charge, checklists) for a route. */
  async fetchVisaTypes(origin: string, destination: string): Promise<VfsVisaType[]> {
    const orig3 = ISO2_TO_ISO3[origin.toUpperCase()];
    const dest3 = ISO2_TO_ISO3[destination.toUpperCase()];
    if (!orig3 || !dest3) return [];

    const name = `${dest3} > ${orig3} > en`;

    // ── ATTEMPT 1: exact `name` match (fast path) ──
    // Works for the ~20 countries whose onePager `name` follows the clean
    // "{dest} > {orig} > en" format (Latvia, Bulgaria, Denmark, …).
    let data = await this.fetchOnePagerWithRetry({ 'fields.name': name });
    if (data && (data.total ?? 0) > 0) {
      const result = this.parse(data);
      if (result.length > 0) return result;
    }

    // ── ATTEMPT 2: structured-field lookup (discover, don't guess) ──
    // Many routes (Italy, Germany, Belgium, Iceland…) store the onePager with a
    // NULL or non-standard `name` (e.g. "ita > ind > it > bangalore"), so the
    // exact-name match above finds nothing. But every entry reliably carries
    // sourceCountry / targetCountry / language fields — look it up by those.
    // Some destinations use a VFS sub-code (France → "frp"), so we try the
    // standard ISO3 first, then any known aliases.
    const targetCodes = [dest3, ...(VFS_TARGET_ALIASES[dest3] ?? [])];
    for (const target of targetCodes) {
      this.logger.log(`name-match empty for ${name} — structured lookup ${target}<-${orig3}`);
      data = await this.fetchOnePagerWithRetry({
        'fields.sourceCountry': orig3,
        'fields.targetCountry': target,
        'fields.language': 'en',
        limit: '1',
      });
      if (data && (data.total ?? 0) > 0) {
        const result = this.parse(data);
        if (result.length > 0) {
          this.logger.log(`structured-field lookup ${target}<-${orig3}: ${result.length} visa types`);
          return result;
        }
      }
    }

    // ── ATTEMPT 3: countryPage content type (same space, different type) ──
    // Last resort for routes with no usable onePager at all.
    this.logger.log(`onePager empty for ${name} — trying countryPage fallback`);
    try {
      const cpData = await this.query('countryPage', { 'fields.locale': name, include: '10' });
      if (cpData && (cpData.total ?? 0) > 0) {
        const cpResult = this.parse(cpData);
        if (cpResult.length > 0) {
          this.logger.log(`countryPage fallback ${name}: ${cpResult.length} visa types`);
          return cpResult;
        }
      }
    } catch (e) {
      this.logger.warn(`countryPage fallback failed for ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }

    return [];
  }

  /**
   * Queries the onePager content type with include=10 and retries until the
   * linked entries look complete. Contentful sometimes returns the entry
   * (total>0) but with truncated includes under load, so we retry with backoff
   * until we have at least a few linked boxes (a real page always has a
   * fee-table entry + the visa-type dropdown).
   */
  private async fetchOnePagerWithRetry(
    params: Record<string, string>,
  ): Promise<any | null> {
    const isIncomplete = (d: any): boolean => {
      if (!d || (d.total ?? 0) === 0) return true;
      const entries = d?.includes?.Entry ?? [];
      return entries.length < 3;
    };

    const q = { ...params, include: '10' };
    let data = await this.query('onePager', q);
    const backoffs = [2500, 5000, 8000, 12000];
    for (let i = 0; isIncomplete(data) && i < backoffs.length; i++) {
      await new Promise((r) => setTimeout(r, backoffs[i]));
      const retry = await this.query('onePager', q);
      if (retry && !isIncomplete(retry)) {
        data = retry;
        break;
      }
      if (retry) data = retry;
    }
    return data;
  }

  private async query(
    contentType: string,
    params: Record<string, string>,
    retried = false,
  ): Promise<any | null> {
    let token = this.tokenService.getToken();
    if (!token) {
      token = await this.tokenService.refreshToken();
      if (!token) return null;
    }
    try {
      const res = await axios.get(this.baseUrl, {
        params: { content_type: contentType, ...params },
        headers: {
          Authorization: `Bearer ${token}`,
          Referer: 'https://visa.vfsglobal.com/',
          'Accept-Language': 'en-US',
        },
        timeout: 30000,
      });
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      if ((status === 401 || status === 403) && !retried) {
        const fresh = await this.tokenService.refreshToken();
        if (fresh) return this.query(contentType, params, true);
      }
      this.logger.warn(`onePager query failed: ${err?.message ?? String(err)}`);
      return null;
    }
  }

  // ── Parsing ────────────────────────────────────────────────────────────────

  private parse(data: any): VfsVisaType[] {
    const entries: any[] = data?.includes?.Entry ?? [];
    const assets: any[] = data?.includes?.Asset ?? [];
    const byId: Record<string, any> = {};
    entries.forEach((e) => (byId[e.sys.id] = e));
    const assetById: Record<string, any> = {};
    assets.forEach((a) => (assetById[a.sys.id] = a));

    const serviceCharge = this.parseServiceCharge(this.collectText(data));
    const pdfs = assets
      .map((a) => ({
        title: a?.fields?.title ?? '',
        url: a?.fields?.file?.url ? 'https:' + a.fields.file.url : null,
      }))
      .filter((p) => p.url && /\.pdf/i.test(p.url));
    const applicationForm = pdfs.find((p) =>
      /application[-\s]?form|sample.*form/i.test(p.title),
    );

    // ── PRIMARY: the authoritative ordered dropdown (matches the VFS website) ──
    const vti = entries.find(
      (e) => e?.sys?.contentType?.sys?.id === 'visaTypeInformation' &&
        Array.isArray(e?.fields?.visaTypes),
    );
    // Build a name→fees map from ALL fee-table entries, so dropdown types whose
    // fee table isn't embedded in visaInformation (e.g. Austria) still get fees.
    const feesByName: Record<string, VfsFeeRow[]> = {};
    for (const e of entries) {
      if (!e?.fields?.table) continue;
      // parseHtmlFeeTable returns [] for non-fee tables (no currency column), so
      // we no longer need the brittle "visa fee" text gate that skipped valid
      // tables labelled "Visa Category" etc. (e.g. China routes).
      const fees = this.parseHtmlFeeTable(e.fields.table);
      if (fees.length === 0) continue;
      const nm = this.norm(this.visaTypeFromInternalName(e.fields.internalName || ''));
      if (nm) feesByName[nm] = fees;
    }

    if (vti) {
      const result = this.parseFromDropdown(vti, byId, assetById, pdfs, applicationForm, serviceCharge, feesByName);
      if (result.length > 0) {
        this.logger.log(`Parsed ${result.length} visa types from dropdown`);
        return result;
      }
    }

    // ── FALLBACK: derive from fee tables (countries without a dropdown entry) ──
    const feeTables = entries
      .filter((e) => e?.fields?.table)
      .map((e) => ({
        visaType: this.visaTypeFromInternalName(e.fields.internalName || ''),
        fees: this.parseHtmlFeeTable(e.fields.table),
      }))
      .filter((t) => t.visaType && t.fees.length > 0);

    const visaTypes: VfsVisaType[] = feeTables.map((t) => {
      const checklist = this.matchChecklist(t.visaType, pdfs);
      return {
        category: this.guessCategory(t.visaType, checklist?.title),
        name: t.visaType,
        fees: t.fees,
        service_fee: serviceCharge?.amount ?? null,
        service_fee_currency: serviceCharge?.currency ?? null,
        service_fee_note: serviceCharge?.note ?? null,
        checklist_pdf_url: checklist?.url ?? null,
        checklist_name: checklist?.title ?? null,
        application_form_url: applicationForm?.url ?? null,
        processing_time: null,
        photo_specifications: null,
        overview: null,
      };
    });

    this.logger.log(`Parsed ${visaTypes.length} visa types (fee-table fallback)`);
    return visaTypes;
  }

  /**
   * Builds the visa-type list from the authoritative visaTypeInformation entry,
   * which holds the EXACT ordered dropdown (matching the VFS website), grouped
   * under SCHENGEN-VISA / NATIONAL VISA headers.
   */
  private parseFromDropdown(
    vti: any,
    byId: Record<string, any>,
    assetById: Record<string, any>,
    pdfs: { title: string; url: string | null }[],
    applicationForm: { title: string; url: string | null } | undefined,
    serviceCharge: { amount: number; currency: string; note: string } | null,
    feesByName: Record<string, VfsFeeRow[]> = {},
  ): VfsVisaType[] {
    const out: VfsVisaType[] = [];
    let category = 'Schengen Visa';

    for (const link of vti.fields.visaTypes) {
      const entry = byId[link?.sys?.id];
      if (!entry) continue;
      const name = (entry.fields?.visaType ?? '').replace(/\s+/g, ' ').trim();
      if (!name) continue;

      // Category separators / placeholders
      if (/please select|^jurisdiction$/i.test(name)) continue;
      if (/schengen[\s-]*visa/i.test(name)) { category = 'Schengen Visa'; continue; }
      if (/national\s*visa/i.test(name)) { category = 'National Visa'; continue; }

      // Resolve this type's embedded fee table + application form from visaInformation
      const info = entry.fields?.visaInformation;
      const tableEntry = this.findEmbeddedTable(info, byId);
      let fees = tableEntry ? this.parseHtmlFeeTable(tableEntry.fields.table) : [];
      // Fallback: match a fee table by visa-type name (countries that don't embed it)
      if (fees.length === 0) fees = feesByName[this.norm(name)] ?? [];
      const appUrl = this.findEformsLink(info) ?? applicationForm?.url ?? null;
      const processingTime = this.extractSectionText(info, byId, /processing time/i);
      const checklist = this.matchChecklist(name, pdfs);

      out.push({
        category,
        name,
        fees,
        service_fee: serviceCharge?.amount ?? null,
        service_fee_currency: serviceCharge?.currency ?? null,
        service_fee_note: serviceCharge?.note ?? null,
        checklist_pdf_url: checklist?.url ?? null,
        checklist_name: checklist?.title ?? null,
        application_form_url: appUrl,
        processing_time: processingTime,
        photo_specifications: null,
        overview: null,
      });
    }
    return out;
  }

  /**
   * Extracts the text of a named section (e.g. "Processing Time") from a
   * visaInformation doc. Sections are delimited by embedded `tab` entries;
   * we collect the text between the target tab and the next tab.
   */
  private extractSectionText(
    info: any,
    byId: Record<string, any>,
    sectionRe: RegExp,
  ): string | null {
    const tokens: Array<{ tab?: string; text?: string }> = [];
    const walk = (n: any) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.nodeType?.startsWith('embedded-') && n.data?.target?.sys?.id) {
        const e = byId[n.data.target.sys.id];
        if (e?.sys?.contentType?.sys?.id === 'tab') {
          tokens.push({ tab: e.fields?.tabName ?? '' });
          return;
        }
      }
      if (n.nodeType === 'text' && n.value) tokens.push({ text: n.value });
      if (n.content) walk(n.content);
    };
    walk(info);

    let collecting = false;
    const parts: string[] = [];
    for (const t of tokens) {
      if (t.tab !== undefined) {
        if (collecting) break; // reached the next tab → stop
        if (sectionRe.test(t.tab)) collecting = true;
        continue;
      }
      if (collecting && t.text) parts.push(t.text);
    }
    const s = parts
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/^processing time[:\s]*/i, '')
      .trim();
    return s || null;
  }

  /** Finds the fee-table entry embedded within a visaInformation rich-text doc. */
  private findEmbeddedTable(info: any, byId: Record<string, any>): any | null {
    let found: any = null;
    const walk = (n: any) => {
      if (!n || typeof n !== 'object' || found) return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.nodeType?.startsWith('embedded-') && n.data?.target?.sys?.id) {
        const e = byId[n.data.target.sys.id];
        if (e?.fields?.table && this.parseHtmlFeeTable(e.fields.table).length > 0) { found = e; return; }
      }
      if (n.content) walk(n.content);
    };
    walk(info);
    return found;
  }

  /** Finds the VFS eForms application link within a visaInformation doc. */
  private findEformsLink(info: any): string | null {
    let url: string | null = null;
    const walk = (n: any) => {
      if (!n || typeof n !== 'object' || url) return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.data?.uri && /eforms\.vfsglobal/i.test(n.data.uri)) { url = n.data.uri; return; }
      if (n.content) walk(n.content);
    };
    walk(info);
    return url;
  }

  /**
   * Extracts the visa-type name from a fee-table entry's internalName,
   * handling the different formats VFS uses across countries.
   */
  private visaTypeFromInternalName(internalName: string): string {
    let s = internalName.replace(/^Table:\s*/i, '').trim();
    if (s.includes('>')) {
      const parts = s.split('>').map((p) => p.trim());
      const meaningful = parts.filter(
        (p) =>
          p &&
          !/^[a-z]{2,3}$/i.test(p) && // locale codes: aut, ind, en
          !/^(table:\s*)?visa fees?\s*\d*$/i.test(p) && // "Visa Fees 1"
          !/^\d+$/.test(p),
      );
      s = meaningful[meaningful.length - 1] || s;
    }
    // "Table:" can also appear inside a segment (e.g. "Table:Tourist Visa")
    return s.replace(/^Table:\s*/i, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Parses a VFS fee table into rows of { label, inr, eur }. Origin-agnostic:
   * VFS tables differ by origin — simple "Label | EUR | INR" (India) and complex
   * multi-row, grouped, multi-currency layouts (e.g. China: a "In Euros | In CNY"
   * pair repeated per nationality group). We capture the canonical EUR fee (present
   * in every Schengen table) and INR when present; other local currencies (CNY,
   * RUB…) are recognised for column alignment but not yet stored (EUR-first).
   *
   * A table is only treated as a fee table if it has at least one currency column —
   * that keeps non-fee tables (e.g. "Processing Time") from being mis-parsed.
   */
  private parseHtmlFeeTable(html: string): VfsFeeRow[] {
    const strip = (c: string) =>
      c
        .replace(/<[^>]+>/g, '')
        .replace(/&#8364;/g, '€')
        .replace(/&#8377;/g, '₹')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
      [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => strip(c[1])),
    );
    if (rows.length < 2) return [];

    // Map a header cell to a currency-column tag. EUR/INR are captured; any other
    // recognised currency becomes 'OTHER' so column positions stay aligned with
    // the data row's numeric cells.
    const OTHER_CUR =
      /\bcny\b|yuan|\brmb\b|\brub\b|rouble|ruble|\busd\b|dollar|\$|\baed\b|dirham|krona|\bsek\b|\bnok\b|\bdkk\b|\bchf\b|franc|zloty|\bpln\b|forint|\bhuf\b|koruna|\bczk\b|\blev\b|\bbgn\b|\bron\b|\bgbp\b|pound|\bjpy\b|yen|baht|\bthb\b|ringgit|\bmyr\b|peso|\bphp\b|local currency/i;
    const toCur = (s: string): 'EUR' | 'INR' | 'OTHER' | null => {
      if (/euro|€|\beur\b/i.test(s)) return 'EUR';
      if (/inr|rupee|₹|indian/i.test(s)) return 'INR';
      if (OTHER_CUR.test(s)) return 'OTHER';
      return null;
    };
    const numOf = (s: string): number | null => {
      if (!/\d/.test(s)) return null;
      const cleaned = s.replace(/[^\d.]/g, '');
      const n = parseFloat(cleaned);
      return cleaned && !isNaN(n) ? n : null;
    };
    const isNumericCell = (s: string) => /^[^a-zA-Z]*\d[\d,.\s/-]*$/.test(s) && numOf(s) !== null;

    // Header rows precede the first row that contains a numeric (amount) cell.
    const firstDataIdx = rows.findIndex((cells) => cells.some(isNumericCell));
    if (firstDataIdx === -1) return [];

    // Pick the header row with the most currency columns; its currency cells (in
    // order, label cells dropped) define the currency sequence per data column.
    let currencySeq: ('EUR' | 'INR' | 'OTHER')[] = [];
    for (const hr of rows.slice(0, firstDataIdx + 1)) {
      const seq = hr.map(toCur).filter((c): c is 'EUR' | 'INR' | 'OTHER' => c !== null);
      if (seq.length > currencySeq.length) currencySeq = seq;
    }
    if (currencySeq.length === 0) return []; // no currency column → not a fee table

    const out: VfsFeeRow[] = [];
    for (let r = firstDataIdx; r < rows.length; r++) {
      const cells = rows[r];
      const label = cells.find((c) => c && !isNumericCell(c)) ?? '';
      const amounts = cells.filter(isNumericCell).map(numOf);
      if (!label || amounts.length === 0) continue;

      // Pair the Nth amount with the Nth currency; take the first EUR / first INR.
      let inr: number | null = null;
      let eur: number | null = null;
      for (let i = 0; i < amounts.length && i < currencySeq.length; i++) {
        if (currencySeq[i] === 'EUR' && eur === null) eur = amounts[i];
        if (currencySeq[i] === 'INR' && inr === null) inr = amounts[i];
      }
      if (inr !== null || eur !== null) out.push({ label, inr, eur });
    }
    return out;
  }

  private parseServiceCharge(
    text: string,
  ): { amount: number; currency: string; note: string } | null {
    // The amount can sit right after the keyword ("service charge of INR 1026")
    // OR be separated from it by a parenthetical, e.g. Italy:
    //   "VFS Service Charge (inclusive of GST –SGST @9% and CGST@9%), of INR 631"
    // So we allow a bounded gap between "service charge" and the amount and take
    // the FIRST currency amount that follows. Ordered INR-first, then EUR.
    const GAP = '[\\s\\S]{0,160}?';
    const attempts: Array<{ re: RegExp; cur: string }> = [
      { re: new RegExp(`service charge${GAP}(?:INR|Rs\\.?|₹)\\s*([\\d,]+)`, 'i'), cur: 'INR' },
      { re: new RegExp(`service charge${GAP}([\\d,]+)\\s*/?-?\\s*(?:INR|Rs\\.?|₹|rupees?)`, 'i'), cur: 'INR' },
      { re: new RegExp(`service charge${GAP}(?:EUR|€)\\s*([\\d.,]+)`, 'i'), cur: 'EUR' },
      { re: new RegExp(`service charge${GAP}([\\d.,]+)\\s*Euros?`, 'i'), cur: 'EUR' },
    ];
    let amount: number | null = null;
    let currency = 'INR';
    for (const a of attempts) {
      const m = text.match(a.re);
      if (m) {
        amount = this.toNumber(m[1]);
        currency = a.cur;
        break;
      }
    }
    if (amount === null) return null;
    const noteMatch = text.match(/[^.]*service charge[^.]*\./i);
    return {
      amount,
      currency,
      note: noteMatch ? noteMatch[0].trim().slice(0, 300) : `Service charge of ${currency} ${amount}`,
    };
  }

  private matchChecklist(
    visaType: string,
    pdfs: { title: string; url: string | null }[],
  ): { title: string; url: string | null } | null {
    const keywords: Record<string, RegExp> = {
      business: /business/i,
      tourist: /tourism|tourist|visiting/i,
      study: /study/i,
      employment: /work|employ/i,
      'vocational training': /vocational/i,
      dependent: /dependent/i,
      'phd and researchers': /research|phd|internship/i,
    };
    const key = Object.keys(keywords).find((k) => this.norm(visaType).includes(this.norm(k)));
    const re = key ? keywords[key] : new RegExp(this.norm(visaType).split(' ')[0], 'i');
    return pdfs.find((p) => /checklist/i.test(p.title) && re.test(p.title)) ?? null;
  }

  private checklistDerivedTypes(
    pdfs: { title: string; url: string | null }[],
  ): { name: string; title: string; url: string | null }[] {
    // Map checklist filename patterns → a clean visa-type name.
    // Covers Schengen (C) + National (D) types so countries that publish
    // checklists but no fee tables still surface their visa types.
    const map: { pattern: RegExp; name: string }[] = [
      { pattern: /checklist-c-business/i, name: 'Business Visit' },
      { pattern: /checklist-c-tourism|visiting-family/i, name: 'Tourist Visit' },
      { pattern: /checklist-c-others-medical/i, name: 'Medical Treatment' },
      { pattern: /checklist-c-others-cultural|sports|religious|film/i, name: 'Cultural / Sports / Religious' },
      { pattern: /checklist-c-others-seafarer/i, name: 'Seafarers' },
      { pattern: /checklist-c-others-research|study-or-other-types-of-internship/i, name: 'Research / Internship' },
      { pattern: /checklist-d-study|checklist_d_study/i, name: 'Study' },
      { pattern: /checklist-d-work/i, name: 'Employment' },
      { pattern: /checklist-d-dependent/i, name: 'Dependent' },
      { pattern: /checklist-d-vocational/i, name: 'Vocational Training' },
      { pattern: /checklist-d-others/i, name: 'Others (National)' },
    ];
    const out: { name: string; title: string; url: string | null }[] = [];
    for (const m of map) {
      const pdf = pdfs.find((p) => m.pattern.test(p.title) || (p.url && m.pattern.test(p.url)));
      if (pdf && !out.some((o) => o.name === m.name)) {
        out.push({ name: m.name, title: pdf.title, url: pdf.url });
      }
    }
    return out;
  }

  private guessCategory(visaType: string, checklistTitle?: string | null): string {
    const hay = `${visaType} ${checklistTitle ?? ''}`.toLowerCase();
    if (/-d-|national|study|work|employ|vocational|dependent|researcher/i.test(hay)) {
      return 'National Visa';
    }
    return 'Schengen Visa';
  }

  // ── helpers ──
  private collectText(node: any, acc: string[] = []): string {
    if (!node || typeof node !== 'object') return acc.join(' ');
    if (Array.isArray(node)) {
      node.forEach((n) => this.collectText(n, acc));
      return acc.join(' ');
    }
    if (node.nodeType === 'text' && node.value) acc.push(node.value);
    for (const k in node) {
      if (k === 'sys' || k === 'metadata') continue;
      if (typeof node[k] === 'object') this.collectText(node[k], acc);
    }
    return acc.join(' ');
  }

  private toNumber(s: string | undefined): number | null {
    if (!s) return null;
    const n = parseFloat(s.replace(/[, ]/g, ''));
    return isNaN(n) ? null : n;
  }

  private norm(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }
}
