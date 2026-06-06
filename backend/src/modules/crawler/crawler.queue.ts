export const CRAWL_QUEUE_NAME = 'crawl-queue';

export enum CrawlJobPriority {
  HIGH = 1,
  LOW = 10,
}

export interface CrawlJobData {
  origin: string;
  destination: string;
  routeId?: string;
  sourceUrl?: string;
  priority: CrawlJobPriority;
}
