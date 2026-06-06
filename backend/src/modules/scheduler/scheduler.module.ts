import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CrawlerModule } from '../crawler/crawler.module';

@Module({
  imports: [CrawlerModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
