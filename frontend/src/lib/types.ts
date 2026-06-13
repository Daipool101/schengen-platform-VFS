export interface Country {
  country_code: string;
  country_code_3: string;
  country_name: string;
  currency_code: string;
  is_schengen: boolean;
}

export interface VisaRequirement {
  visa_fee: number | null;
  visa_fee_currency: string;
  service_fee: number | null;
  service_fee_currency: string;
  processing_time_min: number | null;
  processing_time_max: number | null;
  processing_time_notes: string | null;
  insurance_required: boolean;
  insurance_min_coverage: number | null;
  vaccination_required: boolean;
  vaccination_notes: string | null;
  min_passport_validity_days: number | null;
  eligibility_notes: string | null;
  last_verified_at: string | null;
  data_freshness_status: 'fresh' | 'stale' | 'unknown';
  confidence_level: 'high' | 'medium' | 'low';
}

export interface VisaDocument {
  document_name: string;
  is_mandatory: boolean;
  notes: string | null;
  validity_notes: string | null;
  display_order: number;
}

export interface VacCenter {
  center_name: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  working_hours: string | null;
}

export interface TravelAdvisory {
  advisory_type: string;
  title: string;
  description: string;
  effective_date: string | null;
  source_url: string | null;
  created_at: string;
}

export interface EsimRecommendation {
  is_recommended: boolean;
  providers: string[];
  coverage_notes: string | null;
}

export interface VisaExemptInfo {
  exempt: boolean;
  reason: string;
  max_stay_days: number;
  period_days: number;
  notes: string;
}

export interface VisaTypeFee {
  fee_label: string;
  fee_inr: number | null;
  fee_eur: number | null;
  display_order: number;
}

export interface VisaType {
  id: string;
  category: string;
  name: string;
  overview: string | null;
  processing_time: string | null;
  photo_specifications: string | null;
  application_form_url: string | null;
  service_fee: number | null;
  service_fee_currency: string | null;
  service_fee_note: string | null;
  checklist_pdf_url: string | null;
  checklist_name: string | null;
  source_url: string | null;
  display_order: number;
  visa_type_fees: VisaTypeFee[];
}

export interface RouteSearchResult {
  status?: 'found' | 'stale' | 'pending' | 'visa_exempt' | 'unsupported';
  visa_types?: VisaType[];
  route: {
    origin_country: string;
    destination_country: string;
    route_status: string;
    application_center: string;
    visa_category: string;
    is_application_allowed: boolean;
  };
  requirements: VisaRequirement | null;
  documents: VisaDocument[];
  vac_centers: VacCenter[];
  advisories: TravelAdvisory[];
  esim: EsimRecommendation | null;
  visa_exempt?: VisaExemptInfo;
  converted_fee?: {
    amount: number;
    currency: string;
  };
}

export interface CrawlJob {
  jobId: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  message: string;
}
