import { Module } from '@nestjs/common';
import { AdvisoriesService } from './advisories.service';
import { AdvisoriesController } from './advisories.controller';

@Module({
  controllers: [AdvisoriesController],
  providers: [AdvisoriesService],
  exports: [AdvisoriesService],
})
export class AdvisoriesModule {}
