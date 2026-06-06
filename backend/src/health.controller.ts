import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'schengen-platform-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  root() {
    return {
      status: 'ok',
      message: 'Schengen Visa Route Intelligence API',
    };
  }
}
