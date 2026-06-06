import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { VisaRoutesService } from './visa-routes.service';

@Controller('routes')
export class VisaRoutesController {
  constructor(private readonly visaRoutesService: VisaRoutesService) {}

  @Get(':origin/:destination')
  async searchRoute(
    @Param('origin') origin: string,
    @Param('destination') destination: string,
    @Res() res: Response,
  ) {
    const result = await this.visaRoutesService.searchRoute(origin, destination);

    if (result.status === 'pending') {
      return res.status(HttpStatus.ACCEPTED).json({
        message:
          'Route not found in our database. A data collection job has been queued.',
        jobId: result.jobId,
        meta: result.meta,
      });
    }

    return res.status(HttpStatus.OK).json(result);
  }
}
