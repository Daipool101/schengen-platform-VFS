import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';

@Injectable()
export class AdvisoriesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findByOriginDestination(origin: string, destination: string) {
    const { data: route, error: routeError } = await this.supabase
      .from('visa_routes')
      .select('id')
      .eq('origin_country', origin.toUpperCase())
      .eq('destination_country', destination.toUpperCase())
      .single();

    if (routeError || !route) {
      throw new NotFoundException(`Route ${origin} -> ${destination} not found`);
    }

    const { data, error } = await this.supabase
      .from('travel_advisories')
      .select('*')
      .eq('route_id', route.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch advisories: ${error.message}`);
    }

    return data ?? [];
  }
}
