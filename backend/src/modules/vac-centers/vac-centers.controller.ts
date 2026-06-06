import { Controller, Get, Param } from '@nestjs/common';
import { VacCentersService } from './vac-centers.service';

@Controller('vac-centers')
export class VacCentersController {
  constructor(private readonly vacCentersService: VacCentersService) {}

  @Get(':origin/:destination')
  async findByOriginDestination(
    @Param('origin') origin: string,
    @Param('destination') destination: string,
  ) {
    return this.vacCentersService.findByOriginDestination(origin, destination);
  }

  @Get(':origin')
  async findByOrigin(@Param('origin') origin: string) {
    return this.vacCentersService.findByOrigin(origin);
  }
}
