import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Get(':from/:to')
  async getRate(
    @Param('from') from: string,
    @Param('to') to: string,
  ) {
    return this.exchangeRatesService.getRate(from, to);
  }

  @Get(':from/:to/convert')
  async convert(
    @Param('from') from: string,
    @Param('to') to: string,
    @Query('amount') amount: string,
  ) {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return { error: 'Invalid amount parameter' };
    }
    return this.exchangeRatesService.convertAmount(numericAmount, from, to);
  }
}
