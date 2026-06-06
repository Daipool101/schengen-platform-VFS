import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CrawlerService } from './crawler.service';
import { CRAWL_QUEUE_NAME, CrawlJobData } from './crawler.queue';

@Processor(CRAWL_QUEUE_NAME)
export class CrawlerProcessor {
  private readonly logger = new Logger(CrawlerProcessor.name);

  constructor(private readonly crawlerService: CrawlerService) {}

  @Process('crawl')
  async handleCrawl(job: Job<CrawlJobData>): Promise<void> {
    const { origin, destination, routeId } = job.data;

    this.logger.log(
      `Processing crawl job #${job.id} for ${origin} -> ${destination}`,
    );

    try {
      await this.crawlerService.crawlRoute(origin, destination, routeId);
      this.logger.log(`Crawl job #${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Crawl job #${job.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
