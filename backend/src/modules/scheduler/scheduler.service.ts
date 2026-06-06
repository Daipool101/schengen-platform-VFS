import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';
import { CrawlerService } from '../crawler/crawler.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly crawlerService: CrawlerService,
  ) {}

  @Cron('0 2 * * *', { timeZone: 'UTC' })
  async refreshStaleRoutes(): Promise<void> {
    this.logger.log('Daily refresh job started at 2 AM UTC');

    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: staleRoutes, error } = await this.supabase
        .from('visa_routes')
        .select(
          `
          id,
          origin_country,
          destination_country,
          visa_requirements!inner(last_verified_at)
        `,
        )
        .lt('visa_requirements.last_verified_at', cutoff)
        .eq('route_status', 'active');

      if (error) {
        this.logger.error(`Failed to fetch stale routes: ${error.message}`);
        return;
      }

      if (!staleRoutes || staleRoutes.length === 0) {
        this.logger.log('No stale routes found. Skipping refresh.');
        return;
      }

      this.logger.log(`Enqueuing ${staleRoutes.length} stale routes for refresh`);

      for (const route of staleRoutes) {
        await this.crawlerService.enqueueLowPriority(
          route.origin_country,
          route.destination_country,
          route.id,
        );
      }

      this.logger.log(`Daily refresh: enqueued ${staleRoutes.length} routes`);
    } catch (err) {
      this.logger.error(
        `Daily refresh job failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
