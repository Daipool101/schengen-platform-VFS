import { Controller, Get, Param } from '@nestjs/common';
import { AdvisoriesService } from './advisories.service';

@Controller('advisories')
export class AdvisoriesController {
  constructor(private readonly advisoriesService: AdvisoriesService) {}

  @Get(':origin/:destination')
  async findByOriginDestination(
    @Param('origin') origin: string,
    @Param('destination') destination: string,
  ) {
    return this.advisoriesService.findByOriginDestination(origin, destination);
  }
}
