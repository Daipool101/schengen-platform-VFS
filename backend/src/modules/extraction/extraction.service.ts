import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
} from '@google/generative-ai';

export interface ExtractedVisaData {
  visa_fee: number | null;
  visa_fee_currency: string | null;
  service_fee: number | null;
  processing_time_min: number | null;
  processing_time_max: number | null;
  insurance_required: boolean | null;
  insurance_min_coverage: number | null;
  vaccination_required: boolean | null;
  vaccination_notes: string | null;
  min_passport_validity_days: number | null;
  eligibility_notes: string | null;
  documents: Array<{
    name: string;
    mandatory: boolean;
    notes: string | null;
  }>;
  vac_centers: Array<{
    city: string;
    address: string | null;
    phone: string | null;
    working_hours: string | null;
  }>;
  advisories: Array<{
    type: string;
    title: string;
    description: string;
  }>;
  source_confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly model: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-1.5-flash was deprecated and returns 404. Use a current model.
    const modelName = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async extractVisaData(
    markdownContent: string,
    originCountry?: string,
    destinationCountry?: string,
  ): Promise<ExtractedVisaData> {
    const routeContext = originCountry && destinationCountry
      ? `\nRoute context: Visa application from ${originCountry} (origin) to ${destinationCountry} (destination).`
      : '';

    const prompt = `You are a visa data extraction specialist. Extract structured visa information from the webpage content below.
${routeContext}

RULES:
- Return ONLY valid JSON. No markdown, no explanation, no extra text.
- Use null for fields you cannot confidently find in the text. Do NOT guess.
- Extract the visa fee EXACTLY as shown, with its currency. Examples: "$80.90" -> visa_fee: 80.90, visa_fee_currency: "USD"; "EUR 90" or "€90" -> visa_fee: 90, visa_fee_currency: "EUR"; "₹1,500" -> visa_fee: 1500, visa_fee_currency: "INR". Currency symbols: $ = USD, € = EUR, £ = GBP, ₹ = INR.
- Extract processing time in days. "up to 10 working days" -> processing_time_min: null, processing_time_max: 10.
- Extract ALL document names you find — both mandatory and optional. If documents are grouped under categories (e.g. Tourist / Business / Minors), extract the Tourist or general-category documents.
- Only set insurance_required / insurance_min_coverage if the page explicitly mentions a travel insurance requirement. Do NOT assume it.
- For VAC centers, extract city names and any address/phone/hours you find.
- source_confidence: "high" if from official government/embassy source, "medium" if from VFS, "low" if from aggregator or if data is sparse.

JSON Schema (respond with this exact shape):
{
  "visa_fee": number | null,
  "visa_fee_currency": string | null,
  "service_fee": number | null,
  "processing_time_min": number | null,
  "processing_time_max": number | null,
  "insurance_required": boolean,
  "insurance_min_coverage": number | null,
  "vaccination_required": boolean | null,
  "vaccination_notes": string | null,
  "min_passport_validity_days": number | null,
  "eligibility_notes": string | null,
  "documents": [{"name": string, "mandatory": boolean, "notes": string | null}],
  "vac_centers": [{"city": string, "address": string | null, "phone": string | null, "working_hours": string | null}],
  "advisories": [{"type": string, "title": string, "description": string}],
  "source_confidence": "high" | "medium" | "low"
}

Webpage content (extract from this):
${markdownContent.slice(0, 12000)}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      // Strip markdown code fences if present
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      const parsed: ExtractedVisaData = JSON.parse(cleaned);
      return parsed;
    } catch (error) {
      this.logger.error(
        `Gemini extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.emptyExtraction();
    }
  }

  private emptyExtraction(): ExtractedVisaData {
    return {
      visa_fee: null,
      visa_fee_currency: null,
      service_fee: null,
      processing_time_min: null,
      processing_time_max: null,
      insurance_required: null,
      insurance_min_coverage: null,
      vaccination_required: null,
      vaccination_notes: null,
      min_passport_validity_days: null,
      eligibility_notes: null,
      documents: [],
      vac_centers: [],
      advisories: [],
      source_confidence: 'low',
    };
  }
}
