import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';

@Injectable()
export class VacCentersService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findByOriginDestination(origin: string, destination: string) {
    const { data, error } = await this.supabase
      .from('vac_centers')
      .select('*')
      .eq('origin_country', origin.toUpperCase())
      .eq('destination_country', destination.toUpperCase())
      .eq('is_active', true)
      .order('city', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch VAC centers: ${error.message}`);
    }

    return data ?? [];
  }

  async findByOrigin(origin: string) {
    const { data, error } = await this.supabase
      .from('vac_centers')
      .select('*')
      .eq('origin_country', origin.toUpperCase())
      .eq('is_active', true)
      .order('destination_country', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch VAC centers: ${error.message}`);
    }

    return data ?? [];
  }
}
