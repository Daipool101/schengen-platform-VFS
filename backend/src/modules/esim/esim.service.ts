import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';

@Injectable()
export class EsimService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findByDestination(destination: string) {
    const { data, error } = await this.supabase
      .from('esim_recommendations')
      .select('*')
      .eq('destination_country', destination.toUpperCase())
      .single();

    if (error || !data) {
      return {
        destination_country: destination.toUpperCase(),
        is_recommended: true,
        providers: ['Airalo', 'Holafly', 'Ubigi'],
        coverage_notes:
          'eSIM is widely supported across Schengen countries. Check provider coverage for your specific destination.',
      };
    }

    return data;
  }

  async upsertRecommendation(
    destination: string,
    isRecommended: boolean,
    providers: string[],
    coverageNotes: string,
  ) {
    const { data, error } = await this.supabase
      .from('esim_recommendations')
      .upsert(
        {
          destination_country: destination.toUpperCase(),
          is_recommended: isRecommended,
          providers,
          coverage_notes: coverageNotes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'destination_country' },
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert eSIM recommendation: ${error.message}`);
    }

    return data;
  }
}
