import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { SUPABASE_CLIENT } from '../../database/database.module';

const RATE_FRESHNESS_MS = 60 * 60 * 1000; // 1 hour

interface ExchangeRateApiResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
  time_last_update_unix: number;
}

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  async getRate(from: string, to: string): Promise<{ from: string; to: string; rate: number; fetched_at: string }> {
    const fromCurrency = from.toUpperCase();
    const toCurrency = to.toUpperCase();

    if (fromCurrency === toCurrency) {
      return { from: fromCurrency, to: toCurrency, rate: 1, fetched_at: new Date().toISOString() };
    }

    const { data: cachedRate } = await this.supabase
      .from('exchange_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .single();

    if (cachedRate) {
      const fetchedAt = new Date(cachedRate.fetched_at).getTime();
      const isStale = Date.now() - fetchedAt > RATE_FRESHNESS_MS;

      if (!isStale) {
        return {
          from: fromCurrency,
          to: toCurrency,
          rate: parseFloat(cachedRate.rate),
          fetched_at: cachedRate.fetched_at,
        };
      }
    }

    const freshRate = await this.fetchFromApi(fromCurrency, toCurrency);
    return freshRate;
  }

  async convertAmount(
    amount: number,
    from: string,
    to: string,
  ): Promise<{ amount: number; from: string; to: string; converted: number; rate: number }> {
    const rateData = await this.getRate(from, to);
    const converted = amount * rateData.rate;
    return {
      amount,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      converted: Math.round(converted * 100) / 100,
      rate: rateData.rate,
    };
  }

  private async fetchFromApi(from: string, to: string): Promise<{ from: string; to: string; rate: number; fetched_at: string }> {
    try {
      const url = `https://open.er-api.com/v6/latest/${from}`;
      const response = await axios.get<ExchangeRateApiResponse>(url, {
        timeout: 10000,
      });

      const apiData = response.data;
      if (apiData.result !== 'success') {
        throw new Error(`Exchange rate API returned non-success result`);
      }

      const rate = apiData.rates[to];
      if (rate === undefined) {
        throw new Error(`Currency ${to} not found in exchange rate response`);
      }

      const now = new Date().toISOString();

      await this.supabase.from('exchange_rates').upsert(
        {
          from_currency: from,
          to_currency: to,
          rate,
          fetched_at: now,
        },
        { onConflict: 'from_currency,to_currency' },
      );

      return { from, to, rate, fetched_at: now };
    } catch (error) {
      this.logger.error(
        `Failed to fetch exchange rate ${from}->${to}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
