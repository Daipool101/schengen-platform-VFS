import { Module } from '@nestjs/common';
import { VisaRoutesService } from './visa-routes.service';
import { VisaRoutesController } from './visa-routes.controller';
import { CrawlerModule } from '../crawler/crawler.module';

@Module({
  imports: [CrawlerModule],
  controllers: [VisaRoutesController],
  providers: [VisaRoutesService],
  exports: [VisaRoutesService],
})
export class VisaRoutesModule {}
