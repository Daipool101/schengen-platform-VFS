import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';
import { CrawlerService } from '../crawler/crawler.service';
import { getVisaExemption, VisaExemptInfo } from './visa-policy';

const FRESHNESS_THRESHOLD_HOURS = 24;

export interface RouteSearchResult {
  status: 'found' | 'stale' | 'pending' | 'visa_exempt' | 'unsupported';
  jobId?: string;
  route?: any;
  requirements?: any;
  documents?: any[];
  vac_centers?: any[];
  advisories?: any[];
  esim?: any;
  visa_types?: any[];
  visa_exempt?: VisaExemptInfo;
  meta: {
    origin: string;
    destination: string;
    last_verified_at: string | null;
    data_freshness: string;
  };
}

@Injectable()
export class VisaRoutesService {
  private readonly logger = new Logger(VisaRoutesService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly crawlerService: CrawlerService,
  ) {}

  async searchRoute(origin: string, destination: string): Promise<RouteSearchResult> {
    const orig = origin.toUpperCase();
    const dest = destination.toUpperCase();

    // ── STEP 0: Visa-exempt check (no visa needed → skip crawl entirely) ──
    const exemption = getVisaExemption(orig, dest);
    if (exemption?.exempt) {
      this.logger.log(`${orig}->${dest} is visa-exempt — returning no-visa-required`);
      return {
        status: 'visa_exempt',
        visa_exempt: exemption,
        meta: {
          origin: orig,
          destination: dest,
          last_verified_at: null,
          data_freshness: 'n/a',
        },
      };
    }

    const { data: route } = await this.supabase
      .from('visa_routes')
      .select('*')
      .eq('origin_country', orig)
      .eq('destination_country', dest)
      .single();

    if (!route) {
      const jobId = this.crawlerService.enqueueHighPriority(orig, dest);
      await this.supabase.from('visa_routes').insert({
        origin_country: orig,
        destination_country: dest,
        route_status: 'pending',
      });
      return {
        status: 'pending',
        jobId,
        meta: {
          origin: orig,
          destination: dest,
          last_verified_at: null,
          data_freshness: 'unknown',
        },
      };
    }

    // Route was crawled but VFS publishes no data for it → not supported (Phase 2).
    // Return immediately instead of re-crawling on every search.
    if (route.route_status === 'unsupported') {
      return {
        status: 'unsupported',
        meta: {
          origin: orig,
          destination: dest,
          last_verified_at: route.updated_at ?? null,
          data_freshness: 'unsupported',
        },
      };
    }

    const details = await this.getRouteWithDetails(route.id, orig, dest);

    // Route row exists but has no requirements data yet — it's still being crawled,
    // OR a previous crawl died. Re-trigger a crawl if one isn't already running,
    // then keep returning 202 so the frontend keeps polling.
    if (!details.requirements) {
      if (!this.crawlerService.isCrawlInFlight(orig, dest)) {
        this.crawlerService.enqueueHighPriority(orig, dest);
      }
      return {
        status: 'pending',
        meta: {
          origin: orig,
          destination: dest,
          last_verified_at: null,
          data_freshness: 'pending',
        },
      };
    }

    const requirements = details.requirements;
    const isStale = this.isDataStale(requirements?.last_verified_at);

    if (isStale) {
      await this.crawlerService.enqueueLowPriority(orig, dest, route.id);
      return {
        status: 'stale',
        ...details,
        meta: {
          origin: orig,
          destination: dest,
          last_verified_at: requirements?.last_verified_at ?? null,
          data_freshness: 'stale',
        },
      };
    }

    return {
      status: 'found',
      ...details,
      meta: {
        origin: orig,
        destination: dest,
        last_verified_at: requirements?.last_verified_at ?? null,
        data_freshness: 'fresh',
      },
    };
  }

  async getRouteWithDetails(
    routeId: string,
    origin: string,
    destination: string,
  ): Promise<Omit<RouteSearchResult, 'status' | 'meta'>> {
    const [
      { data: route },
      { data: requirements },
      { data: documents },
      { data: vac_centers },
      { data: advisories },
      { data: esim },
      { data: visa_types },
    ] = await Promise.all([
      this.supabase.from('visa_routes').select('*').eq('id', routeId).single(),
      this.supabase.from('visa_requirements').select('*').eq('route_id', routeId).single(),
      this.supabase
        .from('visa_documents')
        .select('*')
        .eq('route_id', routeId)
        .order('display_order', { ascending: true }),
      this.supabase
        .from('vac_centers')
        .select('*')
        .eq('origin_country', origin)
        .eq('destination_country', destination)
        .eq('is_active', true),
      this.supabase
        .from('travel_advisories')
        .select('*')
        .eq('route_id', routeId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('esim_recommendations')
        .select('*')
        .eq('destination_country', destination)
        .single(),
      // Per-visa-type data with nested fee rows (gracefully empty if table absent)
      this.supabase
        .from('visa_types')
        .select('*, visa_type_fees(*)')
        .eq('route_id', routeId)
        .order('display_order', { ascending: true }),
    ]);

    return {
      route,
      requirements,
      documents: documents ?? [],
      vac_centers: vac_centers ?? [],
      advisories: advisories ?? [],
      esim: esim ?? null,
      visa_types: visa_types ?? [],
    };
  }

  triggerCrawl(origin: string, destination: string): string {
    return this.crawlerService.enqueueHighPriority(
      origin.toUpperCase(),
      destination.toUpperCase(),
    );
  }

  /**
   * Force a fully fresh crawl for a route. Wipes visa_types so the quality gate
   * doesn't block the new data, then runs crawlRoute synchronously and returns
   * the count of visa types that were stored.
   */
  async forceRecrawl(origin: string, destination: string): Promise<{ visa_types_count: number }> {
    // Resolve (or create) the route row
    const { data: existing } = await this.supabase
      .from('visa_routes')
      .select('id')
      .eq('origin_country', origin)
      .eq('destination_country', destination)
      .maybeSingle();

    let routeId: string;
    if (existing) {
      routeId = existing.id;
    } else {
      const { data: newRoute } = await this.supabase
        .from('visa_routes')
        .insert({ origin_country: origin, destination_country: destination, route_status: 'pending' })
        .select('id')
        .single();
      routeId = newRoute!.id;
    }

    // Wipe visa_types so the quality gate starts fresh (forced recrawl = user intent to refresh)
    await this.supabase.from('visa_types').delete().eq('route_id', routeId);

    // Run synchronously so we can report the result
    await this.crawlerService.crawlRoute(origin, destination, routeId);

    const { data: types } = await this.supabase
      .from('visa_types')
      .select('id')
      .eq('route_id', routeId);

    return { visa_types_count: types?.length ?? 0 };
  }

  private isDataStale(lastVerifiedAt: string | null | undefined): boolean {
    if (!lastVerifiedAt) return true;
    const verifiedDate = new Date(lastVerifiedAt);
    const cutoff = new Date(
      Date.now() - FRESHNESS_THRESHOLD_HOURS * 60 * 60 * 1000,
    );
    return verifiedDate < cutoff;
  }
}
