import { Module } from '@nestjs/common';
import { EsimService } from './esim.service';
import { EsimController } from './esim.controller';

@Module({
  controllers: [EsimController],
  providers: [EsimService],
  exports: [EsimService],
})
export class EsimModule {}
