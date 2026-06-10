import {
  Controller,
  Get,
  Post,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { VisaRoutesService } from './visa-routes.service';

@Controller('routes')
export class VisaRoutesController {
  constructor(private readonly visaRoutesService: VisaRoutesService) {}

  /**
   * Force a full fresh crawl for a specific route, bypassing the Redis queue
   * and the quality gate. Used by admins when a route shows stale/missing data.
   * Protected by X-Admin-Key header (value: ADMIN_SECRET env var or 'vfs-admin').
   */
  @Post(':origin/:destination/recrawl')
  async forceRecrawl(
    @Param('origin') origin: string,
    @Param('destination') destination: string,
    @Headers('x-admin-key') adminKey: string,
    @Res() res: Response,
  ) {
    const validKey = process.env.ADMIN_SECRET ?? 'vfs-admin';
    if (adminKey !== validKey) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid admin key' });
    }
    try {
      const { visa_types_count } = await this.visaRoutesService.forceRecrawl(
        origin.toUpperCase(),
        destination.toUpperCase(),
      );
      return res.status(HttpStatus.OK).json({
        ok: true,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        visa_types_count,
        message: `Recrawl complete. ${visa_types_count} visa type(s) stored.`,
      });
    } catch (e: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: e?.message ?? String(e) });
    }
  }

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
