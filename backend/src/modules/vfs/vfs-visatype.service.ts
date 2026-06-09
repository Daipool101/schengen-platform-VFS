import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISO2_TO_ISO3 } from '../../common/iso-codes';
import { VfsTokenService } from './vfs-token.service';

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

    // Fetch with one empty-retry: under rapid concurrent crawls the Contentful
    // endpoint sometimes returns an empty array; a short wait + retry recovers it.
    let data = await this.query('onePager', { 'fields.name': name, include: '10' });
    if (data && (data.total ?? 0) === 0) {
      await new Promise((r) => setTimeout(r, 2500));
      const retry = await this.query('onePager', { 'fields.name': name, include: '10' });
      if (retry && (retry.total ?? 0) > 0) data = retry;
    }
    if (!data || (data.total ?? 0) === 0) {
      this.logger.log(`No onePager for ${name} — route may not publish visa-type data`);
      return [];
    }

    return this.parse(data);
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

    // 1) Service charge (shared across the route) — from any rich text
    const allText = this.collectText(data);
    const serviceCharge = this.parseServiceCharge(allText);

    // 2) Fee tables — entries with an HTML `table` field naming a visa type.
    //    internalName varies by country:
    //      "Table: Business Visit"  (Poland)
    //      "aut > ind > en > Tourist Visa > Visa Fees 1"  (Austria)
    const feeTables = entries
      .filter((e) => e?.fields?.table && /visa fee/i.test(e.fields.table))
      .map((e) => ({
        visaType: this.visaTypeFromInternalName(e.fields.internalName || ''),
        fees: this.parseHtmlFeeTable(e.fields.table),
      }))
      .filter((t) => t.visaType && t.fees.length > 0);

    // 3) Checklist + form PDFs from assets
    const pdfs = assets
      .map((a) => ({
        title: a?.fields?.title ?? '',
        url: a?.fields?.file?.url ? 'https:' + a.fields.file.url : null,
      }))
      .filter((p) => p.url && /\.pdf/i.test(p.url));

    const applicationForm = pdfs.find((p) => /application[-\s]?form|sample.*form/i.test(p.title));

    // 4) Build visa types from fee tables (each table = a visa type)
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

    // 5) Add visa types that only have a checklist PDF (e.g. National visas with no fee table)
    const namedFromChecklists = this.checklistDerivedTypes(pdfs);
    for (const c of namedFromChecklists) {
      if (!visaTypes.some((v) => this.norm(v.name) === this.norm(c.name))) {
        visaTypes.push({
          category: this.guessCategory(c.name, c.title),
          name: c.name,
          fees: [],
          service_fee: serviceCharge?.amount ?? null,
          service_fee_currency: serviceCharge?.currency ?? null,
          service_fee_note: serviceCharge?.note ?? null,
          checklist_pdf_url: c.url,
          checklist_name: c.title,
          application_form_url: applicationForm?.url ?? null,
          processing_time: null,
          photo_specifications: null,
          overview: null,
        });
      }
    }

    this.logger.log(`Parsed ${visaTypes.length} visa types (${feeTables.length} with fee tables)`);
    return visaTypes;
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
          !/^visa fees?\s*\d*$/i.test(p) && // "Visa Fees 1"
          !/^\d+$/.test(p),
      );
      s = meaningful[meaningful.length - 1] || s;
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  private parseHtmlFeeTable(html: string): VfsFeeRow[] {
    const rows: VfsFeeRow[] = [];
    const trMatches = html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi);
    for (const tr of trMatches) {
      const cells = [...tr[1].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        c[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&#8364;|€/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      if (cells.length < 3) continue;
      // Skip header row
      if (/visa fee/i.test(cells[1]) || /visa type/i.test(cells[0])) continue;
      const inr = this.toNumber(cells[1]);
      const eur = this.toNumber(cells[2]);
      if (cells[0] && (inr !== null || eur !== null)) {
        rows.push({ label: cells[0], inr, eur });
      }
    }
    return rows;
  }

  private parseServiceCharge(
    text: string,
  ): { amount: number; currency: string; note: string } | null {
    // e.g. "there is a service charge of INR 1026/-"
    const m = text.match(/service charge of\s*(INR|EUR|₹)?\s*([\d,]+)/i);
    if (!m) return null;
    const amount = this.toNumber(m[2]);
    if (amount === null) return null;
    const noteMatch = text.match(/[^.]*service charge[^.]*\./i);
    return {
      amount,
      currency: /eur|€/i.test(m[1] || '') ? 'EUR' : 'INR',
      note: noteMatch ? noteMatch[0].trim().slice(0, 300) : `Service charge of INR ${amount}`,
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
