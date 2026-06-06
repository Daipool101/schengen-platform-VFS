import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';

@Injectable()
export class DocumentsService {
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
      .from('visa_documents')
      .select('*')
      .eq('route_id', route.id)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data ?? [];
  }
}
