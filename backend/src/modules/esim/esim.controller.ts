import { Controller, Get, Param } from '@nestjs/common';
import { EsimService } from './esim.service';

@Controller('esim')
export class EsimController {
  constructor(private readonly esimService: EsimService) {}

  @Get(':destination')
  async findByDestination(@Param('destination') destination: string) {
    return this.esimService.findByDestination(destination);
  }
}
