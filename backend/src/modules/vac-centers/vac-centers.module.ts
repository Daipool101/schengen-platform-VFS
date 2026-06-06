import { Module } from '@nestjs/common';
import { VacCentersService } from './vac-centers.service';
import { VacCentersController } from './vac-centers.controller';

@Module({
  controllers: [VacCentersController],
  providers: [VacCentersService],
  exports: [VacCentersService],
})
export class VacCentersModule {}
