import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { VfsVisaType, VfsFeeRow } from './vfs-visatype.service';

// ISO alpha-2 → VFS one-pager country slug (lowercase full name)
const ISO2_TO_SLUG: Record<string, string> = {
  AT: 'austria', BE: 'belgium', BG: 'bulgaria', HR: 'croatia', CZ: 'czech-republic',
  DK: 'denmark', EE: 'estonia', FI: 'finland', FR: 'france',
  DE: 'germany', GR: 'greece', HU: 'hungary', IS: 'iceland',
  IT: 'italy', LV: 'latvia', LI: 'liechtenstein', LT: 'lithuania',
  LU: 'luxembourg', MT: 'malta', NL: 'netherlands', NO: 'norway',
  PL: 'poland', PT: 'portugal', RO: 'romania', SK: 'slovakia', SI: 'slovenia',
  ES: 'spain', SE: 'sweden', CH: 'switzerland', IN: 'india',
};

/**
 * Parses VFS's STATIC one-pager pages:
 *   https://www.vfsglobal.com/one-pager/{destination}/{origin}/english/index.html
 *
 * These are plain HTML (no JS, no auth) and contain the complete per-visa-type
 * data: dropdown of types, fee tables, VFS service charge, document checklists
 * (PDF links), photo specs and processing times. Available for most—but not
 * all—destination countries.
 */
@Injectable()
export class VfsOnePagerService {
  private readonly logger = new Logger(VfsOnePagerService.name);

  async fetchVisaTypes(origin: string, destination: string): Promise<VfsVisaType[]> {
    const destSlug = ISO2_TO_SLUG[destination.toUpperCase()];
    const origSlug = ISO2_TO_SLUG[origin.toUpperCase()];
    if (!destSlug || !origSlug) return [];

    const baseUrl = `https://www.vfsglobal.com/one-pager/${destSlug}/${origSlug}/english/`;
    let html: string;
    try {
      const res = await axios.get(baseUrl + 'index.html', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US',
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
      });
      html = res.data;
    } catch (e) {
      this.logger.log(`One-pager not reachable for ${origin}->${destination}`);
      return [];
    }

    // VFS serves a styled 404 with HTTP 200 — detect stubs by markers/size
    if (!html || html.length < 20000 || /error-404/i.test(html)) {
      this.logger.log(`No one-pager published for ${origin}->${destination}`);
      return [];
    }

    const types = this.parse(html, baseUrl);
    this.logger.log(`One-pager ${origin}->${destination}: parsed ${types.length} visa types`);
    return types;
  }

  // ── Parsing ────────────────────────────────────────────────────────────────

  private parse(html: string, baseUrl: string): VfsVisaType[] {
    const serviceCharge = this.parseServiceCharge(html);

    // 1) Dropdown: <option value="business">&nbsp;&nbsp;Business Visa</option>
    //    Non-indented options are category headers (Short Stay / Long Term).
    const options: Array<{ value: string; label: string; isHeader: boolean }> = [];
    for (const m of html.matchAll(/<option[^>]*value="([^"#]+)"[^>]*>([\s\S]*?)<\/option>/gi)) {
      const rawLabel = m[2];
      const label = rawLabel.replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!label || /please select/i.test(label)) continue;
      const isHeader = !/^(&nbsp;|\s)/.test(rawLabel.replace(/^\s+/, m2 => m2.includes('&nbsp;') ? '&nbsp;' : ''))
        ? !rawLabel.includes('&nbsp;')
        : false;
      options.push({ value: m[1].trim(), label, isHeader: !rawLabel.includes('&nbsp;') });
    }

    // 2) Section boundaries: <div id="{value}" class="component-content dropdown-content">
    const sections: Array<{ id: string; start: number }> = [];
    for (const m of html.matchAll(/<div\s+id="([\w-]+)"\s+class="[^"]*dropdown-content[^"]*"/gi)) {
      sections.push({ id: m[1], start: m.index! });
    }
    const sectionHtml = (id: string): string => {
      const idx = sections.findIndex((s) => s.id === id);
      if (idx === -1) return '';
      const start = sections[idx].start;
      const end = idx + 1 < sections.length ? sections[idx + 1].start : html.length;
      return html.slice(start, end);
    };

    // 3) Build types
    const out: VfsVisaType[] = [];
    let category = 'Schengen Visa';
    for (const opt of options) {
      if (opt.isHeader) {
        category = /long|national/i.test(opt.label) ? 'National Visa (Long Term)' : 'Schengen Visa';
        // Headers sometimes have their own section too (e.g. generic Short Stay info) — skip as a type
        continue;
      }

      const sec = sectionHtml(opt.value);
      const fees = this.parseFeeTables(sec.length ? sec : '');
      const checklist = this.findChecklistPdf(sec, baseUrl);
      const processingTime = this.extractTabText(sec, /processing\s*time/i);
      const appForm = this.findApplicationLink(sec, baseUrl);

      out.push({
        category,
        name: opt.label,
        fees,
        service_fee: serviceCharge?.amount ?? null,
        service_fee_currency: serviceCharge?.currency ?? null,
        service_fee_note: serviceCharge?.note ?? null,
        checklist_pdf_url: checklist?.url ?? null,
        checklist_name: checklist?.name ?? null,
        application_form_url: appForm,
        processing_time: processingTime,
        photo_specifications: null,
        overview: null,
      });
    }
    return out;
  }

  /**
   * Parses every fee table in a section, handling the two layouts VFS uses:
   *   A) Labeled columns — header has "VISA FEES IN INR" / "...IN EUROS" and
   *      cells are bare numbers (Denmark, Latvia, Austria…).
   *   B) Inline amounts — no currency columns; each amount sits inside one cell
   *      as "9900/- INR" / "90 EUR" / "₹9,956" (Bulgaria…).
   * Document/photo tables are ignored because they never contain a cell that is
   * *entirely* a currency amount.
   */
  private parseFeeTables(sectionHtml: string): VfsFeeRow[] {
    const out: VfsFeeRow[] = [];

    const cellsOf = (row: string) =>
      [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        c[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&#8364;/g, '€')
          .replace(/&#8377;/g, '₹')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );

    // True only when the WHOLE cell is a currency amount (not a sentence and not
    // a bare row number). The currency marker is REQUIRED — either as a suffix
    // ("9900/- INR", "90 EUR") or a prefix ("₹9,956", "€90").
    const amountInCell = (s: string): { amt: number; cur: 'INR' | 'EUR' } | null => {
      const m =
        s.match(/^[\s]*([\d][\d,]*(?:\.\d+)?)\s*\/?\s*-?\s*(INR|EUR|Rs\.?|Euros?|Rupees?|₹|€)\s*$/i) ||
        s.match(/^\s*(Rs\.?|INR|EUR|₹|€)\s*([\d][\d,]*(?:\.\d+)?)\s*\/?\s*-?\s*$/i);
      if (!m) return null;
      // First alt: amount in group 1; second alt: amount in group 2
      const amtStr = /^\d/.test(m[1]) ? m[1] : m[2];
      const amt = parseFloat(amtStr.replace(/,/g, ''));
      if (isNaN(amt)) return null;
      return { amt, cur: /eur|€|euro/i.test(s) ? 'EUR' : 'INR' };
    };

    for (const tbl of sectionHtml.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
      const trList = [...tbl[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      if (trList.length < 2) continue;

      const header = cellsOf(trList[0][1]);
      let inrIdx = header.findIndex((x) => /inr|rupee|₹/i.test(x));
      let eurIdx = header.findIndex((x) => /eur|euro|€/i.test(x));
      const labeled = inrIdx >= 0 || eurIdx >= 0;

      if (labeled) {
        // ── Branch A: separate INR / EUR columns ──
        if (inrIdx === -1) inrIdx = -99;
        if (eurIdx === -1) eurIdx = -99;
        for (let r = 1; r < trList.length; r++) {
          const cells = cellsOf(trList[r][1]);
          if (cells.length < 2) continue;
          const num = (i: number) => {
            if (i < 0 || i >= cells.length) return null;
            const n = parseFloat(cells[i].replace(/[^\d.]/g, ''));
            return isNaN(n) ? null : n;
          };
          const inr = num(inrIdx);
          const eur = num(eurIdx);
          if (cells[0] && (inr !== null || eur !== null)) {
            out.push({ label: cells[0], inr, eur });
          }
        }
      } else {
        // ── Branch B: amount embedded in a cell with a currency marker ──
        for (let r = 1; r < trList.length; r++) {
          const cells = cellsOf(trList[r][1]);
          if (cells.length < 2) continue;
          let inr: number | null = null;
          let eur: number | null = null;
          for (const c of cells) {
            const am = amountInCell(c);
            if (am) {
              if (am.cur === 'EUR') eur = am.amt;
              else inr = am.amt;
            }
          }
          if (inr === null && eur === null) continue;
          // Label = first descriptive cell (not an amount, not a bare row number)
          const label =
            cells.find(
              (c) => c && !amountInCell(c) && !/^\d+\.?$/.test(c) && c.length > 1,
            ) ?? 'Visa Fee';
          out.push({ label: label.slice(0, 200), inr, eur });
        }
      }
    }
    return out;
  }

  private parseServiceCharge(
    html: string,
  ): { amount: number; currency: string; note: string } | null {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    // Formats seen across countries:
    //   "VFS Service Fee 2109 (Euro 19)"            (Denmark — INR table)
    //   "service charge of INR 1026/-"               (Poland)
    //   "service charge in INR 1855/-"               (Netherlands)
    //   "service charge of 19 Euros"                 (Sweden — EUR only)
    //   "VFS Service Charge (incl. GST ...), of INR 631"  (Italy — gap before amount)
    let amount: number | null = null;
    let currency = 'INR';

    // Denmark's distinct "VFS Service Fee 2109 (Euro 19)" format first.
    let m = text.match(/VFS\s*Service\s*Fee[:\s]*([\d,]+)\s*(?:\(Euro\s*([\d.]+)\))?/i);
    if (m) {
      amount = parseFloat(m[1].replace(/,/g, ''));
    } else {
      // Allow a bounded gap between "service charge" and the amount, so a
      // parenthetical (e.g. Italy's GST note) between them doesn't hide it.
      const GAP = '[\\s\\S]{0,160}?';
      const attempts: Array<{ re: RegExp; cur: string }> = [
        { re: new RegExp(`service charge${GAP}(?:INR|Rs\\.?|₹)\\s*([\\d,]+)`, 'i'), cur: 'INR' },
        { re: new RegExp(`service charge${GAP}([\\d,]+)\\s*/?-?\\s*(?:INR|Rs\\.?|₹|rupees?)`, 'i'), cur: 'INR' },
        { re: new RegExp(`service charge${GAP}(?:EUR|€)\\s*([\\d.,]+)`, 'i'), cur: 'EUR' },
        { re: new RegExp(`service charge${GAP}([\\d.,]+)\\s*Euros?`, 'i'), cur: 'EUR' },
      ];
      for (const a of attempts) {
        const mm = text.match(a.re);
        if (mm) {
          amount = parseFloat(mm[1].replace(/,/g, ''));
          currency = a.cur;
          break;
        }
      }
    }

    if (amount === null || isNaN(amount)) return null;
    const noteMatch = text.match(/[^.]*(?:VFS Service Fee|service charge)[^.]*\./i);
    return {
      amount,
      currency,
      note: noteMatch ? noteMatch[0].trim().slice(0, 300) : `VFS Service Fee ${currency} ${amount}`,
    };
  }

  private findChecklistPdf(
    sectionHtml: string,
    baseUrl: string,
  ): { url: string; name: string } | null {
    for (const m of sectionHtml.matchAll(/href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]{0,120}?)</gi)) {
      const href = m[1];
      const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (/checklist/i.test(href) || /checklist/i.test(label)) {
        return {
          url: href.startsWith('http') ? href : baseUrl + href.replace(/^\//, ''),
          name: label || href.split('/').pop() || 'Document Checklist',
        };
      }
    }
    return null;
  }

  private findApplicationLink(sectionHtml: string, baseUrl: string): string | null {
    const m =
      sectionHtml.match(/href="(https?:\/\/[^"]*(?:eforms|application)[^"]*)"/i) ??
      sectionHtml.match(/href="([^"]*application[^"]*\.pdf[^"]*)"/i);
    if (!m) return null;
    return m[1].startsWith('http') ? m[1] : baseUrl + m[1].replace(/^\//, '');
  }

  /** Pulls plain text of a tab section (e.g. Processing Time) within a type's HTML. */
  private extractTabText(sectionHtml: string, tabRe: RegExp): string | null {
    // tabs: <li data-content-ref="e">Processing Time</li> ... <div data-content="e">text</div>
    const li = [...sectionHtml.matchAll(/<li[^>]*data-content-ref="(\w+)"[^>]*>([\s\S]*?)<\/li>/gi)]
      .find((m) => tabRe.test(m[2]));
    if (!li) return null;
    const ref = li[1];
    const div = sectionHtml.match(
      new RegExp(`<div[^>]*data-content="${ref}"[^>]*>([\\s\\S]*?)</div>`, 'i'),
    );
    if (!div) return null;
    const text = div[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 600) : null;
  }
}
