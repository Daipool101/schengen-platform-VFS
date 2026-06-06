import { Controller, Get, Param } from '@nestjs/common';
import { RequirementsService } from './requirements.service';

@Controller('requirements')
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Get(':origin/:destination')
  async findByOriginDestination(
    @Param('origin') origin: string,
    @Param('destination') destination: string,
  ) {
    return this.requirementsService.findByOriginDestination(origin, destination);
  }
}
