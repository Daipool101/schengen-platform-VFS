import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { SUPABASE_CLIENT } from '../../database/database.module';
import { ExtractionService, ExtractedVisaData } from '../extraction/extraction.service';
import { hashContent } from '../../common/utils/hash.util';
import {
  CRAWL_QUEUE_NAME,
  CrawlJobData,
  CrawlJobPriority,
} from './crawler.queue';
import {
  SCHENGEN_STANDARD_REQUIREMENTS,
  SCHENGEN_STANDARD_DOCUMENTS,
  isSchengenCountry,
} from './schengen-standard-data';
import { VfsContentfulService, VfsRouteData } from '../vfs/vfs-contentful.service';
import { VfsVisaTypeService, VfsVisaType } from '../vfs/vfs-visatype.service';
import { VfsOnePagerService } from '../vfs/vfs-onepager.service';

// ─── ISO alpha-2 → ISO alpha-3 lowercase (VFS URL format) ────────────────────
// VFS URL pattern: https://visa.vfsglobal.com/{origin3}/en/{dest3}/
const ISO2_TO_ISO3: Record<string, string> = {
  AF:'afg', AL:'alb', DZ:'dza', AD:'and', AO:'ago', AG:'atg', AR:'arg', AM:'arm',
  AU:'aus', AT:'aut', AZ:'aze', BS:'bhs', BH:'bhr', BD:'bgd', BB:'brb', BY:'blr',
  BE:'bel', BZ:'blz', BJ:'ben', BT:'btn', BO:'bol', BA:'bih', BW:'bwa', BR:'bra',
  BN:'brn', BG:'bgr', BF:'bfa', BI:'bdi', CV:'cpv', KH:'khm', CM:'cmr', CA:'can',
  CF:'caf', TD:'tcd', CL:'chl', CN:'chn', CO:'col', KM:'com', CG:'cog', CD:'cod',
  CR:'cri', CI:'civ', HR:'hrv', CU:'cub', CY:'cyp', CZ:'cze', DK:'dnk', DJ:'dji',
  DM:'dma', DO:'dom', EC:'ecu', EG:'egy', SV:'slv', GQ:'gnq', ER:'eri', EE:'est',
  SZ:'swz', ET:'eth', FJ:'fji', FI:'fin', FR:'fra', GA:'gab', GM:'gmb', GE:'geo',
  DE:'deu', GH:'gha', GR:'grc', GD:'grd', GT:'gtm', GN:'gin', GW:'gnb', GY:'guy',
  HT:'hti', HN:'hnd', HU:'hun', IS:'isl', IN:'ind', ID:'idn', IR:'irn', IQ:'irq',
  IE:'irl', IL:'isr', IT:'ita', JM:'jam', JP:'jpn', JO:'jor', KZ:'kaz', KE:'ken',
  KI:'kir', KW:'kwt', KG:'kgz', LA:'lao', LV:'lva', LB:'lbn', LS:'lso', LR:'lbr',
  LY:'lby', LI:'lie', LT:'ltu', LU:'lux', MG:'mdg', MW:'mwi', MY:'mys', MV:'mdv',
  ML:'mli', MT:'mlt', MH:'mhl', MR:'mrt', MU:'mus', MX:'mex', FM:'fsm', MD:'mda',
  MC:'mco', MN:'mng', ME:'mne', MA:'mar', MZ:'moz', MM:'mmr', NA:'nam', NR:'nru',
  NP:'npl', NL:'nld', NZ:'nzl', NI:'nic', NE:'ner', NG:'nga', MK:'mkd', NO:'nor',
  OM:'omn', PK:'pak', PW:'plw', PA:'pan', PG:'png', PY:'pry', PE:'per', PH:'phl',
  PL:'pol', PT:'prt', QA:'qat', RO:'rou', RU:'rus', RW:'rwa', KN:'kna', LC:'lca',
  VC:'vct', WS:'wsm', SM:'smr', ST:'stp', SA:'sau', SN:'sen', RS:'srb', SC:'syc',
  SL:'sle', SG:'sgp', SK:'svk', SI:'svn', SB:'slb', SO:'som', ZA:'zaf', SS:'ssd',
  ES:'esp', LK:'lka', SD:'sdn', SR:'sur', SE:'swe', CH:'che', SY:'syr', TW:'twn',
  TJ:'tjk', TZ:'tza', TH:'tha', TL:'tls', TG:'tgo', TO:'ton', TT:'tto', TN:'tun',
  TR:'tur', TM:'tkm', TV:'tuv', UG:'uga', UA:'ukr', AE:'are', GB:'gbr', US:'usa',
  UY:'ury', UZ:'uzb', VU:'vut', VE:'ven', VN:'vnm', YE:'yem', ZM:'zmb', ZW:'zwe',
  PS:'pse', XK:'xkx',
};

// Schengen country full names for aggregator URL construction
const SCHENGEN_COUNTRY_NAMES: Record<string, string> = {
  AT:'austria', BE:'belgium', HR:'croatia', CZ:'czechia', DK:'denmark',
  EE:'estonia', FI:'finland', FR:'france', DE:'germany', GR:'greece',
  HU:'hungary', IS:'iceland', IT:'italy', LV:'latvia', LI:'liechtenstein',
  LT:'lithuania', LU:'luxembourg', MT:'malta', NL:'netherlands', NO:'norway',
  PL:'poland', PT:'portugal', SK:'slovakia', SI:'slovenia', ES:'spain',
  SE:'sweden', CH:'switzerland',
};

// Country-specific VFS eVisa portal URLs for non-Schengen destinations
const VFS_EVISA_PORTALS: Record<string, string[]> = {
  BR: [
    'https://brazil.vfsevisa.com/checklist',
    'https://brazil.vfsevisa.com/',
  ],
  IN: ['https://indianvisaonline.gov.in/evisa/tvoa.html'],
  AU: ['https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600'],
  US: ['https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html'],
  GB: ['https://www.gov.uk/standard-visitor'],
  CA: ['https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html'],
  NZ: ['https://www.immigration.govt.nz/new-zealand-visas/apply-for-a-visa/about-visa/visitor-visa'],
};

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly firecrawlBaseUrl = 'https://api.firecrawl.dev/v1';

  // Tracks routes with a crawl currently in flight, to avoid duplicate crawls
  // when the frontend polls repeatedly while waiting for data.
  private readonly inFlightCrawls = new Set<string>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly extractionService: ExtractionService,
    private readonly vfsContentful: VfsContentfulService,
    private readonly vfsVisaTypes: VfsVisaTypeService,
    private readonly vfsOnePager: VfsOnePagerService,
    @InjectQueue(CRAWL_QUEUE_NAME) private readonly crawlQueue: Queue,
  ) {}

  /** True if a crawl for this route is already running. */
  isCrawlInFlight(origin: string, destination: string): boolean {
    return this.inFlightCrawls.has(`${origin.toUpperCase()}-${destination.toUpperCase()}`);
  }

  // ─── Queue Management ────────────────────────────────────────────────────────

  /**
   * Returns jobId immediately — never blocks the HTTP response.
   * Enqueues via Redis; falls back to direct crawl if Redis is down.
   */
  enqueueHighPriority(origin: string, destination: string): string {
    const orig = origin.toUpperCase();
    const dest = destination.toUpperCase();
    const jobId = `job-${Date.now()}`;
    const key = `${orig}-${dest}`;

    // Already crawling this route — don't start a duplicate
    if (this.inFlightCrawls.has(key)) {
      this.logger.log(`Crawl already in flight for ${orig}->${dest} — skipping duplicate`);
      return jobId;
    }
    this.inFlightCrawls.add(key);

    // Safety: release the lock after 3 minutes even if the crawl never completes,
    // so the route isn't stuck "pending" forever.
    setTimeout(() => this.inFlightCrawls.delete(key), 180000);

    setImmediate(async () => {
      try {
        await this.crawlQueue.add(
          'crawl',
          { origin: orig, destination: dest, priority: CrawlJobPriority.HIGH } as CrawlJobData,
          { priority: CrawlJobPriority.HIGH, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        );
        this.logger.log(`Queued HIGH priority crawl for ${orig}->${dest} (jobId: ${jobId})`);
      } catch (err) {
        this.logger.warn(`Redis unavailable — running crawl directly for ${orig}->${dest}`);
        // crawlRoute clears the in-flight lock in its finally block
        this.crawlRoute(orig, dest)
          .catch(e => this.logger.error(`Direct crawl failed for ${orig}->${dest}: ${e.message}`));
      }
    });

    return jobId;
  }

  enqueueLowPriority(origin: string, destination: string, routeId?: string): void {
    const orig = origin.toUpperCase();
    const dest = destination.toUpperCase();

    setImmediate(async () => {
      try {
        await this.crawlQueue.add(
          'crawl',
          { origin: orig, destination: dest, routeId, priority: CrawlJobPriority.LOW } as CrawlJobData,
          { priority: CrawlJobPriority.LOW, attempts: 2, backoff: { type: 'fixed', delay: 30000 } },
        );
      } catch {
        this.logger.warn(`Redis unavailable — skipping low-priority refresh for ${orig}->${dest}`);
      }
    });
  }

  // ─── Core Crawl Orchestrator ─────────────────────────────────────────────────

  async crawlRoute(origin: string, destination: string, routeId?: string): Promise<void> {
    const orig = origin.toUpperCase();
    const dest = destination.toUpperCase();
    const key = `${orig}-${dest}`;

    try {
      const resolvedRouteId = routeId ?? (await this.resolveRouteId(orig, dest));
      if (!resolvedRouteId) {
        this.logger.warn(`Could not resolve route id for ${orig}->${dest}`);
        return;
      }

      // ── PRIMARY: fetch REAL VFS data from the Contentful API ──
      let vfsData: VfsRouteData | null = null;
      try {
        vfsData = await this.vfsContentful.fetchRouteData(orig, dest);
      } catch (e) {
        this.logger.warn(
          `VFS Contentful fetch failed for ${orig}->${dest}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      if (vfsData?.found) {
        await this.persistVfsData(resolvedRouteId, orig, dest, vfsData);
        this.logger.log(`✅ Persisted REAL VFS data for ${orig}->${dest}`);
      } else if (isSchengenCountry(dest)) {
        // ── FALLBACK: VFS returned nothing → use Schengen standard checklist ──
        // (covers the page so it isn't empty; clearly the EU-standard baseline)
        await this.seedSchengenStandardData(resolvedRouteId, orig, dest);
        this.logger.log(`VFS empty — seeded Schengen standard fallback for ${orig}->${dest}`);
      } else {
        this.logger.warn(`No VFS data and non-Schengen route ${orig}->${dest} — nothing to persist`);
      }

      // ── Per-visa-type data (fees, service charge, checklist PDFs) ──
      // Two independent VFS sources, fetched and merged:
      //   1. Static one-pager pages (plain HTML, most reliable, most countries)
      //   2. Contentful onePager entries (SPA data source)
      try {
        await new Promise((r) => setTimeout(r, 2000));

        const [opRes, cfRes] = await Promise.allSettled([
          this.vfsOnePager.fetchVisaTypes(orig, dest),
          this.vfsVisaTypes.fetchVisaTypes(orig, dest),
        ]);
        const onePagerTypes = opRes.status === 'fulfilled' ? opRes.value : [];
        const contentfulTypes = cfRes.status === 'fulfilled' ? cfRes.value : [];

        const visaTypes = this.mergeVisaTypeSources(onePagerTypes, contentfulTypes);
        if (visaTypes.length > 0) {
          await this.persistVisaTypes(resolvedRouteId, orig, dest, visaTypes);
          this.logger.log(
            `✅ Persisted ${visaTypes.length} visa types for ${orig}->${dest} ` +
            `(one-pager: ${onePagerTypes.length}, contentful: ${contentfulTypes.length})`,
          );
        }
      } catch (e) {
        this.logger.warn(
          `Visa-type fetch failed for ${orig}->${dest}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } finally {
      // Always release the in-flight lock so future searches can re-crawl
      this.inFlightCrawls.delete(key);
    }
  }

  /**
   * Merges visa types from the two VFS sources. The richer source (more types
   * with actual fee rows, then more types overall) becomes the base; gaps in
   * service fee / processing time / checklist are filled from the other.
   */
  private mergeVisaTypeSources(a: VfsVisaType[], b: VfsVisaType[]): VfsVisaType[] {
    const score = (list: VfsVisaType[]) =>
      list.filter((v) => v.fees.length > 0).length * 10 + list.length;
    const base = score(a) >= score(b) ? a : b;
    const other = base === a ? b : a;
    if (base.length === 0) return other;

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fallbackSvc = other.find((v) => v.service_fee != null);

    return base.map((v) => {
      const match = other.find(
        (o) => norm(o.name) === norm(v.name) ||
          norm(o.name).includes(norm(v.name)) ||
          norm(v.name).includes(norm(o.name)),
      );
      return {
        ...v,
        fees: v.fees.length ? v.fees : match?.fees ?? [],
        service_fee: v.service_fee ?? match?.service_fee ?? fallbackSvc?.service_fee ?? null,
        service_fee_currency:
          v.service_fee_currency ?? match?.service_fee_currency ?? fallbackSvc?.service_fee_currency ?? null,
        service_fee_note: v.service_fee_note ?? match?.service_fee_note ?? fallbackSvc?.service_fee_note ?? null,
        checklist_pdf_url: v.checklist_pdf_url ?? match?.checklist_pdf_url ?? null,
        checklist_name: v.checklist_name ?? match?.checklist_name ?? null,
        application_form_url: v.application_form_url ?? match?.application_form_url ?? null,
        processing_time: v.processing_time ?? match?.processing_time ?? null,
      };
    });
  }

  /**
   * Persists per-visa-type data (fees, VFS service charge, checklist PDFs)
   * into visa_types / visa_type_fees, and snapshots fees into visa_fee_history.
   */
  private async persistVisaTypes(
    routeId: string,
    origin: string,
    destination: string,
    visaTypes: VfsVisaType[],
  ): Promise<void> {
    const now = new Date().toISOString();
    const sourceUrl = `https://visa.vfsglobal.com/${(origin || '').toLowerCase()}/en/${(destination || '').toLowerCase()}/visa-type`;

    // Mirror the VFS service charge into the Visa Overview's Service Fee field
    const svc = visaTypes.find((v) => v.service_fee != null);
    // Real processing time text from VFS (e.g. Business Visit) → Visa Overview
    const ptText = visaTypes.find((v) => v.processing_time)?.processing_time ?? null;
    const reqUpdate: Record<string, any> = { updated_at: now };
    if (svc) {
      reqUpdate.service_fee = svc.service_fee;
      reqUpdate.service_fee_currency = svc.service_fee_currency;
    }
    if (ptText) {
      // Pull day-counts from the VFS text (ignores "48-72 hours" — needs "days")
      const days = [...ptText.matchAll(/(\d+)\s*(?:calendar\s*)?days?/gi)].map((m) =>
        parseInt(m[1], 10),
      );
      if (days.length) {
        reqUpdate.processing_time_min = Math.min(...days);
        reqUpdate.processing_time_max = days.length > 1 ? Math.max(...days) : Math.min(...days);
      }
      reqUpdate.processing_time_notes = ptText.slice(0, 500);
    }
    if (svc || ptText) {
      await this.supabase.from('visa_requirements').update(reqUpdate).eq('route_id', routeId);
    }

    // Clear previous visa types for this route (cascades to fees/docs)
    await this.supabase.from('visa_types').delete().eq('route_id', routeId);

    for (let i = 0; i < visaTypes.length; i++) {
      const vt = visaTypes[i];
      const { data: inserted, error } = await this.supabase
        .from('visa_types')
        .insert({
          route_id: routeId,
          category: vt.category,
          name: vt.name,
          overview: vt.overview,
          processing_time: vt.processing_time,
          photo_specifications: vt.photo_specifications,
          application_form_url: vt.application_form_url,
          service_fee: vt.service_fee,
          service_fee_currency: vt.service_fee_currency,
          service_fee_note: vt.service_fee_note,
          checklist_pdf_url: vt.checklist_pdf_url,
          checklist_name: vt.checklist_name,
          source_url: sourceUrl,
          display_order: i,
          last_verified_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error || !inserted) {
        this.logger.warn(`Failed to insert visa type ${vt.name}: ${error?.message}`);
        continue;
      }

      // Fee rows
      if (vt.fees.length > 0) {
        await this.supabase.from('visa_type_fees').insert(
          vt.fees.map((f, idx) => ({
            visa_type_id: inserted.id,
            fee_label: f.label,
            fee_inr: f.inr,
            fee_eur: f.eur,
            display_order: idx,
          })),
        );

        // Snapshot into fee history (versioning)
        await this.supabase.from('visa_fee_history').insert(
          vt.fees.map((f) => ({
            route_id: routeId,
            visa_type_name: vt.name,
            fee_label: f.label,
            fee_inr: f.inr,
            fee_eur: f.eur,
            service_fee: vt.service_fee,
            service_fee_currency: vt.service_fee_currency,
            source_url: sourceUrl,
            captured_at: now,
          })),
        );
      }
    }
  }

  /**
   * Persists REAL VFS data: VAC centres (clean structured) + fee/document
   * fields extracted from the live VFS content via the LLM.
   */
  private async persistVfsData(
    routeId: string,
    origin: string,
    destination: string,
    vfs: VfsRouteData,
  ): Promise<void> {
    const now = new Date().toISOString();

    // 1) Extract structured fee + document fields from the real VFS text via Gemini
    let extracted = null as Awaited<ReturnType<ExtractionService['extractVisaData']>> | null;
    const combinedText = `${vfs.feesText}\n\n${vfs.documentsText}`.trim();
    if (combinedText.length > 50) {
      extracted = await this.extractionService.extractVisaData(combinedText, origin, destination);
    }

    // 2) Persist requirements (real fee from VFS; Schengen defaults only fill gaps)
    const schengen = isSchengenCountry(destination);
    const reqPayload: Record<string, any> = {
      route_id: routeId,
      visa_fee: extracted?.visa_fee ?? (schengen ? 90 : null),
      visa_fee_currency: extracted?.visa_fee_currency ?? (schengen ? 'EUR' : null),
      service_fee: extracted?.service_fee ?? null,
      service_fee_currency: extracted?.service_fee ? 'INR' : null,
      processing_time_min: extracted?.processing_time_min ?? (schengen ? 15 : null),
      processing_time_max: extracted?.processing_time_max ?? (schengen ? 45 : null),
      insurance_required: extracted?.insurance_required ?? (schengen ? true : null),
      insurance_min_coverage: extracted?.insurance_min_coverage ?? (schengen ? 30000 : null),
      vaccination_required: extracted?.vaccination_required ?? false,
      vaccination_notes: extracted?.vaccination_notes ?? null,
      min_passport_validity_days: extracted?.min_passport_validity_days ?? (schengen ? 90 : null),
      eligibility_notes: extracted?.eligibility_notes ?? null,
      last_verified_at: now,
      data_freshness_status: 'fresh',
      confidence_level: 'high', // sourced directly from VFS
      updated_at: now,
    };

    const { data: existingReq } = await this.supabase
      .from('visa_requirements')
      .select('id')
      .eq('route_id', routeId)
      .maybeSingle();

    if (existingReq) {
      await this.supabase.from('visa_requirements').update(reqPayload).eq('id', existingReq.id);
    } else {
      await this.supabase.from('visa_requirements').insert(reqPayload);
    }

    // 3) Documents: real VFS docs (labelled [VFS]) + standard Schengen
    //    checklist (labelled [STD]) for anything VFS doesn't cover. The
    //    [VFS]/[STD] prefix lets the frontend show a clear source badge.
    const vfsDocs = (extracted?.documents ?? []).map((doc, idx) => ({
      route_id: routeId,
      document_name: doc.name,
      is_mandatory: doc.mandatory,
      notes: `[VFS] ${doc.notes ?? ''}`.trim(),
      display_order: idx,
    }));

    // Keywords already covered by VFS docs (so we don't duplicate them)
    const covered = vfsDocs.map((d) => d.document_name.toLowerCase());
    const isCovered = (name: string) => {
      const n = name.toLowerCase();
      const key = n.split(' ')[0];
      return covered.some((c) => c.includes(key) || n.includes(c.split(' ')[0]));
    };

    let stdDocs: any[] = [];
    if (isSchengenCountry(destination)) {
      stdDocs = SCHENGEN_STANDARD_DOCUMENTS.filter((doc) => !isCovered(doc.name)).map(
        (doc, i) => ({
          route_id: routeId,
          document_name: doc.name,
          is_mandatory: doc.mandatory,
          notes: `[STD] ${doc.notes ?? ''}`.trim(),
          display_order: vfsDocs.length + i,
        }),
      );
    }

    const allDocs = [...vfsDocs, ...stdDocs];
    if (allDocs.length > 0) {
      await this.supabase.from('visa_documents').delete().eq('route_id', routeId);
      await this.supabase.from('visa_documents').insert(allDocs);
    }

    // 4) Replace VAC centres with the REAL ones from VFS Contentful
    if (vfs.vacCenters.length > 0) {
      await this.supabase
        .from('vac_centers')
        .delete()
        .eq('origin_country', origin)
        .eq('destination_country', destination);

      await this.supabase.from('vac_centers').insert(
        vfs.vacCenters.map((c) => ({
          origin_country: origin,
          destination_country: destination,
          center_name: `VFS Global Visa Application Centre – ${c.city}`,
          city: c.city,
          address: c.google_map_url, // map link as the locatable address
          phone: null,
          email: null,
          working_hours: c.working_hours,
          is_active: true,
          updated_at: now,
        })),
      );
    }

    // 5) Mark route active
    await this.supabase
      .from('visa_routes')
      .update({
        route_status: 'active',
        application_center: 'VFS Global',
        visa_category: isSchengenCountry(destination)
          ? 'Schengen Short Stay (Type C)'
          : 'Short Stay',
        updated_at: now,
      })
      .eq('id', routeId);
  }

  /**
   * Seeds the standardized Schengen short-stay visa data (fees, insurance,
   * processing time, and the full document checklist) for a route.
   * Used as the reliable baseline since VFS Global's SPA does not expose
   * this data in scrapable HTML.
   */
  private async seedSchengenStandardData(
    routeId: string,
    origin: string,
    destination: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const std = SCHENGEN_STANDARD_REQUIREMENTS;

    // Only seed requirements if none exist yet (don't overwrite richer VFS data)
    const { data: existingReq } = await this.supabase
      .from('visa_requirements')
      .select('id')
      .eq('route_id', routeId)
      .maybeSingle();

    if (!existingReq) {
      await this.supabase.from('visa_requirements').insert({
        route_id: routeId,
        visa_fee: std.visa_fee,
        visa_fee_currency: std.visa_fee_currency,
        service_fee: null, // service fee comes only from real VFS data — never hardcoded
        service_fee_currency: null,
        processing_time_min: std.processing_time_min,
        processing_time_max: std.processing_time_max,
        insurance_required: std.insurance_required,
        insurance_min_coverage: std.insurance_min_coverage,
        vaccination_required: std.vaccination_required,
        vaccination_notes: std.vaccination_notes,
        min_passport_validity_days: std.min_passport_validity_days,
        eligibility_notes: std.eligibility_notes,
        last_verified_at: now,
        data_freshness_status: 'fresh',
        confidence_level: 'medium', // EU-standard baseline, not route-specific VFS data
        updated_at: now,
      });
    }

    // Seed standard document checklist if no documents exist yet
    const { data: existingDocs } = await this.supabase
      .from('visa_documents')
      .select('id')
      .eq('route_id', routeId)
      .limit(1);

    if (!existingDocs || existingDocs.length === 0) {
      await this.supabase.from('visa_documents').insert(
        SCHENGEN_STANDARD_DOCUMENTS.map((doc, idx) => ({
          route_id: routeId,
          document_name: doc.name,
          is_mandatory: doc.mandatory,
          notes: `[STD] ${doc.notes ?? ''}`.trim(),
          display_order: idx,
        })),
      );
    }

    // Mark route active
    await this.supabase
      .from('visa_routes')
      .update({
        route_status: 'active',
        application_center: 'VFS Global',
        visa_category: 'Schengen Short Stay (Type C)',
        updated_at: now,
      })
      .eq('id', routeId);
  }

  // ─── URL Strategy ────────────────────────────────────────────────────────────

  /**
   * Builds prioritised list of source URLs for a route.
   *
   * Priority order:
   * 1. VFS Global per-country portal  (visa.vfsglobal.com/{origin3}/en/{dest3}/)
   * 2. VFS required-documents sub-page
   * 3. VFS prepare-application sub-page
   * 4. Schengen visa info aggregator
   * 5. Destination country official Schengen visa info page
   */
  private buildCrawlUrls(
    origin: string,
    destination: string,
  ): Array<{ url: string; type: string }> {
    const orig3 = ISO2_TO_ISO3[origin.toUpperCase()];
    const dest3  = ISO2_TO_ISO3[destination.toUpperCase()];
    const destUpper = destination.toUpperCase();
    const destName = SCHENGEN_COUNTRY_NAMES[destUpper];
    const isSchengen = !!destName;

    const urls: Array<{ url: string; type: string }> = [];

    if (isSchengen) {
      // ── Schengen destination: use visa.vfsglobal.com portal ──
      if (orig3 && dest3) {
        const vfsBase = `https://visa.vfsglobal.com/${orig3}/en/${dest3}`;
        urls.push({ url: `${vfsBase}/`,                                  type: 'vfs_main' });
        urls.push({ url: `${vfsBase}/attend-centre/required-documents`,  type: 'vfs_docs' });
        urls.push({ url: `${vfsBase}/attend-centre/prepare-application`, type: 'vfs_prep' });
      }

      // Schengen info aggregator
      urls.push({
        url: `https://www.schengenvisainfo.com/${destName}-visa/`,
        type: 'aggregator',
      });

      // EU official Schengen page
      urls.push({
        url: 'https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en',
        type: 'eu_official',
      });
    } else {
      // ── Non-Schengen destination: use country-specific VFS eVisa portals ──
      const evisaUrls = VFS_EVISA_PORTALS[destUpper] ?? [];
      for (const u of evisaUrls) {
        urls.push({ url: u, type: 'vfs_evisa' });
      }

      // Fallback: try the VFS global portal anyway (may have info for some routes)
      if (orig3 && dest3 && evisaUrls.length === 0) {
        const vfsBase = `https://visa.vfsglobal.com/${orig3}/en/${dest3}`;
        urls.push({ url: `${vfsBase}/`, type: 'vfs_main' });
      }
    }

    return urls;
  }

  // ─── Single URL Crawl ────────────────────────────────────────────────────────

  private async crawlSingleUrl(
    url: string,
    sourceType: string,
    origin: string,
    destination: string,
    routeId: string | undefined,
    apiKey: string,
  ): Promise<boolean> {
    // Upsert source record
    const { data: sourceRecord } = await this.supabase
      .from('source_records')
      .upsert(
        {
          route_id: routeId ?? null,
          source_url: url,
          source_type: sourceType,
          crawl_status: 'crawling',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select('id, content_hash')
      .single();

    const sourceRecordId: string | undefined = sourceRecord?.id;
    const previousHash: string | undefined = sourceRecord?.content_hash ?? undefined;

    // ── Call Firecrawl v1 with correct params ──
    let markdownContent: string;
    try {
      const response = await axios.post(
        `${this.firecrawlBaseUrl}/scrape`,
        {
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          blockAds: true,
          // proxy: "stealth" handles Cloudflare-protected pages (VFS, embassy sites)
          proxy: 'stealth',
          waitFor: 4000,
          timeout: 35000,
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        },
      );

      // Firecrawl v1 response shape: { success: true, data: { markdown: "..." } }
      markdownContent = response.data?.data?.markdown ?? '';
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? String(err);
      this.logger.warn(`Firecrawl failed [${sourceType}] ${url}: ${msg}`);
      if (sourceRecordId) {
        await this.supabase.from('source_records').update({
          crawl_status: 'failed',
          error_message: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq('id', sourceRecordId);
      }
      return false;
    }

    if (!markdownContent?.trim()) {
      this.logger.warn(`Empty content from [${sourceType}] ${url}`);
      return false;
    }

    const newHash = hashContent(markdownContent);

    // No change detected — just update last_crawled_at
    if (previousHash && previousHash === newHash) {
      this.logger.log(`No change detected [${sourceType}] — skipping extraction`);
      if (sourceRecordId) {
        await this.supabase.from('source_records').update({
          crawl_status: 'success',
          last_crawled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', sourceRecordId);
      }
      return true;
    }

    // Content changed — extract structured data
    this.logger.log(`Content changed [${sourceType}] — running LLM extraction`);
    const extracted = await this.extractionService.extractVisaData(markdownContent, origin, destination);

    // Persist extracted data
    const resolvedRouteId = routeId ?? await this.resolveRouteId(origin, destination);
    if (resolvedRouteId) {
      await this.persistExtractedData(resolvedRouteId, extracted, origin, destination);

      if (previousHash && sourceRecordId) {
        await this.logChange(resolvedRouteId, url, 'content_hash', previousHash, newHash);
      }
    }

    // Update source record
    if (sourceRecordId) {
      await this.supabase.from('source_records').update({
        route_id: resolvedRouteId ?? null,
        crawl_status: 'success',
        content_hash: newHash,
        last_crawled_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq('id', sourceRecordId);
    }

    this.logger.log(`✅ Crawled & persisted [${sourceType}] ${origin}->${destination}`);
    return true;
  }

  // ─── Data Persistence ────────────────────────────────────────────────────────

  private async resolveRouteId(origin: string, destination: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('visa_routes')
      .select('id')
      .eq('origin_country', origin.toUpperCase())
      .eq('destination_country', destination.toUpperCase())
      .single();

    if (data) return data.id;

    const { data: newRoute } = await this.supabase
      .from('visa_routes')
      .insert({
        origin_country: origin.toUpperCase(),
        destination_country: destination.toUpperCase(),
        route_status: 'active',
        visa_category: 'Schengen Short Stay',
      })
      .select('id')
      .single();

    return newRoute?.id ?? null;
  }

  private async persistExtractedData(
    routeId: string,
    data: ExtractedVisaData,
    origin: string,
    destination: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const isSchengen = isSchengenCountry(destination);

    // Helper: pick the crawled value only if it's meaningful, else keep existing
    const merge = <T>(crawled: T | null | undefined, existing: T | null | undefined): T | null =>
      crawled !== null && crawled !== undefined ? crawled : (existing ?? null);

    // ── Merge requirements (NEVER overwrite good data with nulls) ──
    const { data: existingReq } = await this.supabase
      .from('visa_requirements')
      .select('*')
      .eq('route_id', routeId)
      .maybeSingle();

    const reqPayload = {
      route_id: routeId,
      visa_fee: merge(data.visa_fee, existingReq?.visa_fee) ?? (isSchengen ? 90 : null),
      visa_fee_currency: merge(data.visa_fee_currency, existingReq?.visa_fee_currency) ?? (isSchengen ? 'EUR' : null),
      service_fee: merge(data.service_fee, existingReq?.service_fee),
      processing_time_min: merge(data.processing_time_min, existingReq?.processing_time_min) ?? (isSchengen ? 15 : null),
      processing_time_max: merge(data.processing_time_max, existingReq?.processing_time_max) ?? (isSchengen ? 45 : null),
      insurance_required: merge(data.insurance_required, existingReq?.insurance_required) ?? (isSchengen ? true : null),
      insurance_min_coverage: merge(data.insurance_min_coverage, existingReq?.insurance_min_coverage) ?? (isSchengen ? 30000 : null),
      vaccination_required: merge(data.vaccination_required, existingReq?.vaccination_required) ?? false,
      vaccination_notes: merge(data.vaccination_notes, existingReq?.vaccination_notes),
      min_passport_validity_days: merge(data.min_passport_validity_days, existingReq?.min_passport_validity_days) ?? (isSchengen ? 90 : null),
      eligibility_notes: merge(data.eligibility_notes, existingReq?.eligibility_notes),
      last_verified_at: now,
      data_freshness_status: 'fresh',
      // Keep the higher confidence (seeded Schengen data is 'high')
      confidence_level: existingReq?.confidence_level === 'high'
        ? 'high'
        : (data.source_confidence ?? existingReq?.confidence_level ?? 'medium'),
      updated_at: now,
    };

    if (existingReq) {
      await this.supabase.from('visa_requirements').update(reqPayload).eq('id', existingReq.id);
    } else {
      await this.supabase.from('visa_requirements').insert(reqPayload);
    }

    // ── Replace documents ONLY if crawl found a richer list than what exists ──
    if (data.documents && data.documents.length > 0) {
      const { count: existingDocCount } = await this.supabase
        .from('visa_documents')
        .select('id', { count: 'exact', head: true })
        .eq('route_id', routeId);

      // Only overwrite if the crawled list is at least as complete as the existing
      // (prevents a poor crawl from wiping the standard Schengen checklist)
      if (data.documents.length >= (existingDocCount ?? 0)) {
        await this.supabase.from('visa_documents').delete().eq('route_id', routeId);
        await this.supabase.from('visa_documents').insert(
          data.documents.map((doc, idx) => ({
            route_id: routeId,
            document_name: doc.name,
            is_mandatory: doc.mandatory,
            notes: doc.notes ?? null,
            display_order: idx,
          })),
        );
      }
    }

    // ── Replace VAC centers (only if extracted) ──
    if (data.vac_centers && data.vac_centers.length > 0) {
      await this.supabase.from('vac_centers')
        .delete()
        .eq('origin_country', origin.toUpperCase())
        .eq('destination_country', destination.toUpperCase());

      await this.supabase.from('vac_centers').insert(
        data.vac_centers.map(c => ({
          origin_country: origin.toUpperCase(),
          destination_country: destination.toUpperCase(),
          city: c.city,
          address: c.address ?? null,
          phone: c.phone ?? null,
          working_hours: c.working_hours ?? null,
          is_active: true,
          updated_at: now,
        })),
      );
    }

    // ── Append advisories ──
    if (data.advisories && data.advisories.length > 0) {
      await this.supabase.from('travel_advisories').insert(
        data.advisories.map(a => ({
          route_id: routeId,
          advisory_type: a.type ?? 'general',
          title: a.title,
          description: a.description,
          is_active: true,
          created_at: now,
        })),
      );
    }

    // ── Update route status to active ──
    await this.supabase.from('visa_routes').update({
      route_status: 'active',
      application_center: 'VFS Global',
      updated_at: now,
    }).eq('id', routeId);
  }

  private async logChange(
    routeId: string,
    sourceUrl: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
  ): Promise<void> {
    await this.supabase.from('change_logs').insert({
      route_id: routeId,
      table_name: 'source_records',
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      detected_at: new Date().toISOString(),
      source_url: sourceUrl,
    });
  }
}
