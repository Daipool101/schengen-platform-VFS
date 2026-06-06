import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';

@Injectable()
export class RequirementsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findByRoute(routeId: string) {
    const { data, error } = await this.supabase
      .from('visa_requirements')
      .select('*')
      .eq('route_id', routeId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Requirements not found for route ${routeId}`);
    }

    return data;
  }

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

    return this.findByRoute(route.id);
  }
}
