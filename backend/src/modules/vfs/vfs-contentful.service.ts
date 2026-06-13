import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISO2_TO_ISO3 } from '../../common/iso-codes';
import { VfsTokenService } from './vfs-token.service';
import { flattenRichText, cleanText } from './contentful-richtext.util';

export interface VfsVacCenter {
  city: string;
  iso_code: string | null;
  lat: number | null;
  lon: number | null;
  google_map_url: string | null;
  working_hours: string | null;
}

export interface VfsRouteData {
  found: boolean;
  vacCenters: VfsVacCenter[];
  feesText: string;       // real VFS fee content (for LLM extraction)
  documentsText: string;  // real VFS "what to bring" content (for LLM extraction)
}

@Injectable()
export class VfsContentfulService {
  private readonly logger = new Logger(VfsContentfulService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: VfsTokenService,
  ) {
    this.baseUrl =
      this.configService.get<string>('CONTENTFUL_BASE_URL') ??
      'https://d2ab400qlgxn2g.cloudfront.net/dev/spaces/xxg4p8gt3sg6/environments/master/entries';
  }

  /** Fetches all available VFS data for an origin→destination route. */
  async fetchRouteData(origin: string, destination: string): Promise<VfsRouteData> {
    const orig3 = ISO2_TO_ISO3[origin.toUpperCase()];
    const dest3 = ISO2_TO_ISO3[destination.toUpperCase()];
    const empty: VfsRouteData = { found: false, vacCenters: [], feesText: '', documentsText: '' };

    if (!orig3 || !dest3) {
      this.logger.warn(`No ISO3 mapping for ${origin}->${destination}`);
      return empty;
    }

    // VFS locale format: "deu > ind > en"  (destination > origin > language)
    const locale = `${dest3} > ${orig3} > en`;

    // Use [match] (contains) rather than exact equality: VFS locale strings vary
    // by origin (some carry a trailing city/language suffix), so an exact match
    // misses valid routes. [match] keeps it origin-agnostic.
    const [locations, pages] = await Promise.all([
      this.query('countryLocation', { 'fields.title[match]': locale, include: '10' }),
      this.query('countryPage', { 'fields.locale[match]': `${dest3} > ${orig3}`, include: '4' }),
    ]);

    if (!locations && !pages) return empty;

    const vacCenters = this.parseVacCenters(locations);
    const { feesText, documentsText } = this.parsePages(pages);

    const found = vacCenters.length > 0 || feesText.length > 0 || documentsText.length > 0;
    this.logger.log(
      `VFS Contentful ${origin}->${destination}: ${vacCenters.length} VACs, fees=${feesText.length}b, docs=${documentsText.length}b`,
    );

    return { found, vacCenters, feesText, documentsText };
  }

  /** Calls the Contentful API; refreshes the token via Playwright on 401. */
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
        this.logger.warn(`Contentful ${status} — refreshing token and retrying`);
        const fresh = await this.tokenService.refreshToken();
        if (fresh) return this.query(contentType, params, true);
      }
      this.logger.warn(
        `Contentful query failed [${contentType}]: ${err?.message ?? String(err)}`,
      );
      return null;
    }
  }

  private parseVacCenters(data: any): VfsVacCenter[] {
    const items = data?.items ?? [];
    const centers: VfsVacCenter[] = [];

    for (const item of items) {
      const f = item?.fields ?? {};
      if (!f.vacName) continue;

      // openingHoursObject is a clean array of { day, hours, description }
      let hours: string | null = null;
      if (Array.isArray(f.openingHoursObject) && f.openingHoursObject.length > 0) {
        hours = f.openingHoursObject
          .filter((h: any) => h?.hours)
          .map((h: any) => `${h.day}: ${h.hours}${h.description ? ` (${h.description})` : ''}`)
          .join('; ');
      }

      centers.push({
        city: f.vacName,
        iso_code: f.isoCode ?? null,
        lat: f.location?.lat ?? null,
        lon: f.location?.lon ?? null,
        google_map_url: f.googleMapUrl ?? null,
        working_hours: hours,
      });
    }
    return centers;
  }

  private parsePages(data: any): { feesText: string; documentsText: string } {
    const items = data?.items ?? [];
    let feesText = '';
    let documentsText = '';

    for (const item of items) {
      const f = item?.fields ?? {};
      const title = (f.title ?? '').toLowerCase();
      const body = f.body ? cleanText(flattenRichText(f.body)) : '';
      if (!body) continue;

      // "common information" holds the visa fee text; some portals use "apply for a visa"
      if (title.includes('common information') || title.includes('apply for a visa')) {
        feesText += `\n\n[${f.title}]\n${body}`;
      }
      // "what to bring with you" holds the document checklist
      if (title.includes('what to bring') || title.includes('required document')) {
        documentsText += `\n\n[${f.title}]\n${body}`;
      }
    }

    return {
      feesText: feesText.slice(0, 14000),
      documentsText: documentsText.slice(0, 14000),
    };
  }
}
