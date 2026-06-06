import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  async findAll() {
    return this.countriesService.findAll();
  }

  @Get('schengen')
  async findSchengen() {
    return this.countriesService.findSchengen();
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard)
  async seed() {
    return this.countriesService.seedCountries();
  }
}
