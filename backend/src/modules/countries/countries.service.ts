import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/database.module';

export interface Country {
  country_code: string;
  country_code_3: string;
  country_name: string;
  currency_code: string;
  is_schengen: boolean;
}

const ALL_COUNTRIES: Country[] = [
  { country_code: 'AF', country_code_3: 'AFG', country_name: 'Afghanistan', currency_code: 'AFN', is_schengen: false },
  { country_code: 'AL', country_code_3: 'ALB', country_name: 'Albania', currency_code: 'ALL', is_schengen: false },
  { country_code: 'DZ', country_code_3: 'DZA', country_name: 'Algeria', currency_code: 'DZD', is_schengen: false },
  { country_code: 'AD', country_code_3: 'AND', country_name: 'Andorra', currency_code: 'EUR', is_schengen: false },
  { country_code: 'AO', country_code_3: 'AGO', country_name: 'Angola', currency_code: 'AOA', is_schengen: false },
  { country_code: 'AG', country_code_3: 'ATG', country_name: 'Antigua and Barbuda', currency_code: 'XCD', is_schengen: false },
  { country_code: 'AR', country_code_3: 'ARG', country_name: 'Argentina', currency_code: 'ARS', is_schengen: false },
  { country_code: 'AM', country_code_3: 'ARM', country_name: 'Armenia', currency_code: 'AMD', is_schengen: false },
  { country_code: 'AU', country_code_3: 'AUS', country_name: 'Australia', currency_code: 'AUD', is_schengen: false },
  { country_code: 'AT', country_code_3: 'AUT', country_name: 'Austria', currency_code: 'EUR', is_schengen: true },
  { country_code: 'AZ', country_code_3: 'AZE', country_name: 'Azerbaijan', currency_code: 'AZN', is_schengen: false },
  { country_code: 'BS', country_code_3: 'BHS', country_name: 'Bahamas', currency_code: 'BSD', is_schengen: false },
  { country_code: 'BH', country_code_3: 'BHR', country_name: 'Bahrain', currency_code: 'BHD', is_schengen: false },
  { country_code: 'BD', country_code_3: 'BGD', country_name: 'Bangladesh', currency_code: 'BDT', is_schengen: false },
  { country_code: 'BB', country_code_3: 'BRB', country_name: 'Barbados', currency_code: 'BBD', is_schengen: false },
  { country_code: 'BY', country_code_3: 'BLR', country_name: 'Belarus', currency_code: 'BYN', is_schengen: false },
  { country_code: 'BE', country_code_3: 'BEL', country_name: 'Belgium', currency_code: 'EUR', is_schengen: true },
  { country_code: 'BZ', country_code_3: 'BLZ', country_name: 'Belize', currency_code: 'BZD', is_schengen: false },
  { country_code: 'BJ', country_code_3: 'BEN', country_name: 'Benin', currency_code: 'XOF', is_schengen: false },
  { country_code: 'BT', country_code_3: 'BTN', country_name: 'Bhutan', currency_code: 'BTN', is_schengen: false },
  { country_code: 'BO', country_code_3: 'BOL', country_name: 'Bolivia', currency_code: 'BOB', is_schengen: false },
  { country_code: 'BA', country_code_3: 'BIH', country_name: 'Bosnia and Herzegovina', currency_code: 'BAM', is_schengen: false },
  { country_code: 'BW', country_code_3: 'BWA', country_name: 'Botswana', currency_code: 'BWP', is_schengen: false },
  { country_code: 'BR', country_code_3: 'BRA', country_name: 'Brazil', currency_code: 'BRL', is_schengen: false },
  { country_code: 'BN', country_code_3: 'BRN', country_name: 'Brunei', currency_code: 'BND', is_schengen: false },
  { country_code: 'BG', country_code_3: 'BGR', country_name: 'Bulgaria', currency_code: 'BGN', is_schengen: false },
  { country_code: 'BF', country_code_3: 'BFA', country_name: 'Burkina Faso', currency_code: 'XOF', is_schengen: false },
  { country_code: 'BI', country_code_3: 'BDI', country_name: 'Burundi', currency_code: 'BIF', is_schengen: false },
  { country_code: 'CV', country_code_3: 'CPV', country_name: 'Cabo Verde', currency_code: 'CVE', is_schengen: false },
  { country_code: 'KH', country_code_3: 'KHM', country_name: 'Cambodia', currency_code: 'KHR', is_schengen: false },
  { country_code: 'CM', country_code_3: 'CMR', country_name: 'Cameroon', currency_code: 'XAF', is_schengen: false },
  { country_code: 'CA', country_code_3: 'CAN', country_name: 'Canada', currency_code: 'CAD', is_schengen: false },
  { country_code: 'CF', country_code_3: 'CAF', country_name: 'Central African Republic', currency_code: 'XAF', is_schengen: false },
  { country_code: 'TD', country_code_3: 'TCD', country_name: 'Chad', currency_code: 'XAF', is_schengen: false },
  { country_code: 'CL', country_code_3: 'CHL', country_name: 'Chile', currency_code: 'CLP', is_schengen: false },
  { country_code: 'CN', country_code_3: 'CHN', country_name: 'China', currency_code: 'CNY', is_schengen: false },
  { country_code: 'CO', country_code_3: 'COL', country_name: 'Colombia', currency_code: 'COP', is_schengen: false },
  { country_code: 'KM', country_code_3: 'COM', country_name: 'Comoros', currency_code: 'KMF', is_schengen: false },
  { country_code: 'CG', country_code_3: 'COG', country_name: 'Congo', currency_code: 'XAF', is_schengen: false },
  { country_code: 'CD', country_code_3: 'COD', country_name: 'Congo (Democratic Republic)', currency_code: 'CDF', is_schengen: false },
  { country_code: 'CR', country_code_3: 'CRI', country_name: 'Costa Rica', currency_code: 'CRC', is_schengen: false },
  { country_code: 'CI', country_code_3: 'CIV', country_name: "Côte d'Ivoire", currency_code: 'XOF', is_schengen: false },
  { country_code: 'HR', country_code_3: 'HRV', country_name: 'Croatia', currency_code: 'EUR', is_schengen: true },
  { country_code: 'CU', country_code_3: 'CUB', country_name: 'Cuba', currency_code: 'CUP', is_schengen: false },
  { country_code: 'CY', country_code_3: 'CYP', country_name: 'Cyprus', currency_code: 'EUR', is_schengen: false },
  { country_code: 'CZ', country_code_3: 'CZE', country_name: 'Czech Republic', currency_code: 'CZK', is_schengen: true },
  { country_code: 'DK', country_code_3: 'DNK', country_name: 'Denmark', currency_code: 'DKK', is_schengen: true },
  { country_code: 'DJ', country_code_3: 'DJI', country_name: 'Djibouti', currency_code: 'DJF', is_schengen: false },
  { country_code: 'DM', country_code_3: 'DMA', country_name: 'Dominica', currency_code: 'XCD', is_schengen: false },
  { country_code: 'DO', country_code_3: 'DOM', country_name: 'Dominican Republic', currency_code: 'DOP', is_schengen: false },
  { country_code: 'EC', country_code_3: 'ECU', country_name: 'Ecuador', currency_code: 'USD', is_schengen: false },
  { country_code: 'EG', country_code_3: 'EGY', country_name: 'Egypt', currency_code: 'EGP', is_schengen: false },
  { country_code: 'SV', country_code_3: 'SLV', country_name: 'El Salvador', currency_code: 'USD', is_schengen: false },
  { country_code: 'GQ', country_code_3: 'GNQ', country_name: 'Equatorial Guinea', currency_code: 'XAF', is_schengen: false },
  { country_code: 'ER', country_code_3: 'ERI', country_name: 'Eritrea', currency_code: 'ERN', is_schengen: false },
  { country_code: 'EE', country_code_3: 'EST', country_name: 'Estonia', currency_code: 'EUR', is_schengen: true },
  { country_code: 'SZ', country_code_3: 'SWZ', country_name: 'Eswatini', currency_code: 'SZL', is_schengen: false },
  { country_code: 'ET', country_code_3: 'ETH', country_name: 'Ethiopia', currency_code: 'ETB', is_schengen: false },
  { country_code: 'FJ', country_code_3: 'FJI', country_name: 'Fiji', currency_code: 'FJD', is_schengen: false },
  { country_code: 'FI', country_code_3: 'FIN', country_name: 'Finland', currency_code: 'EUR', is_schengen: true },
  { country_code: 'FR', country_code_3: 'FRA', country_name: 'France', currency_code: 'EUR', is_schengen: true },
  { country_code: 'GA', country_code_3: 'GAB', country_name: 'Gabon', currency_code: 'XAF', is_schengen: false },
  { country_code: 'GM', country_code_3: 'GMB', country_name: 'Gambia', currency_code: 'GMD', is_schengen: false },
  { country_code: 'GE', country_code_3: 'GEO', country_name: 'Georgia', currency_code: 'GEL', is_schengen: false },
  { country_code: 'DE', country_code_3: 'DEU', country_name: 'Germany', currency_code: 'EUR', is_schengen: true },
  { country_code: 'GH', country_code_3: 'GHA', country_name: 'Ghana', currency_code: 'GHS', is_schengen: false },
  { country_code: 'GR', country_code_3: 'GRC', country_name: 'Greece', currency_code: 'EUR', is_schengen: true },
  { country_code: 'GD', country_code_3: 'GRD', country_name: 'Grenada', currency_code: 'XCD', is_schengen: false },
  { country_code: 'GT', country_code_3: 'GTM', country_name: 'Guatemala', currency_code: 'GTQ', is_schengen: false },
  { country_code: 'GN', country_code_3: 'GIN', country_name: 'Guinea', currency_code: 'GNF', is_schengen: false },
  { country_code: 'GW', country_code_3: 'GNB', country_name: 'Guinea-Bissau', currency_code: 'XOF', is_schengen: false },
  { country_code: 'GY', country_code_3: 'GUY', country_name: 'Guyana', currency_code: 'GYD', is_schengen: false },
  { country_code: 'HT', country_code_3: 'HTI', country_name: 'Haiti', currency_code: 'HTG', is_schengen: false },
  { country_code: 'HN', country_code_3: 'HND', country_name: 'Honduras', currency_code: 'HNL', is_schengen: false },
  { country_code: 'HU', country_code_3: 'HUN', country_name: 'Hungary', currency_code: 'HUF', is_schengen: true },
  { country_code: 'IS', country_code_3: 'ISL', country_name: 'Iceland', currency_code: 'ISK', is_schengen: true },
  { country_code: 'IN', country_code_3: 'IND', country_name: 'India', currency_code: 'INR', is_schengen: false },
  { country_code: 'ID', country_code_3: 'IDN', country_name: 'Indonesia', currency_code: 'IDR', is_schengen: false },
  { country_code: 'IR', country_code_3: 'IRN', country_name: 'Iran', currency_code: 'IRR', is_schengen: false },
  { country_code: 'IQ', country_code_3: 'IRQ', country_name: 'Iraq', currency_code: 'IQD', is_schengen: false },
  { country_code: 'IE', country_code_3: 'IRL', country_name: 'Ireland', currency_code: 'EUR', is_schengen: false },
  { country_code: 'IL', country_code_3: 'ISR', country_name: 'Israel', currency_code: 'ILS', is_schengen: false },
  { country_code: 'IT', country_code_3: 'ITA', country_name: 'Italy', currency_code: 'EUR', is_schengen: true },
  { country_code: 'JM', country_code_3: 'JAM', country_name: 'Jamaica', currency_code: 'JMD', is_schengen: false },
  { country_code: 'JP', country_code_3: 'JPN', country_name: 'Japan', currency_code: 'JPY', is_schengen: false },
  { country_code: 'JO', country_code_3: 'JOR', country_name: 'Jordan', currency_code: 'JOD', is_schengen: false },
  { country_code: 'KZ', country_code_3: 'KAZ', country_name: 'Kazakhstan', currency_code: 'KZT', is_schengen: false },
  { country_code: 'KE', country_code_3: 'KEN', country_name: 'Kenya', currency_code: 'KES', is_schengen: false },
  { country_code: 'KI', country_code_3: 'KIR', country_name: 'Kiribati', currency_code: 'AUD', is_schengen: false },
  { country_code: 'KP', country_code_3: 'PRK', country_name: 'Korea (North)', currency_code: 'KPW', is_schengen: false },
  { country_code: 'KR', country_code_3: 'KOR', country_name: 'Korea (South)', currency_code: 'KRW', is_schengen: false },
  { country_code: 'KW', country_code_3: 'KWT', country_name: 'Kuwait', currency_code: 'KWD', is_schengen: false },
  { country_code: 'KG', country_code_3: 'KGZ', country_name: 'Kyrgyzstan', currency_code: 'KGS', is_schengen: false },
  { country_code: 'LA', country_code_3: 'LAO', country_name: 'Laos', currency_code: 'LAK', is_schengen: false },
  { country_code: 'LV', country_code_3: 'LVA', country_name: 'Latvia', currency_code: 'EUR', is_schengen: true },
  { country_code: 'LB', country_code_3: 'LBN', country_name: 'Lebanon', currency_code: 'LBP', is_schengen: false },
  { country_code: 'LS', country_code_3: 'LSO', country_name: 'Lesotho', currency_code: 'LSL', is_schengen: false },
  { country_code: 'LR', country_code_3: 'LBR', country_name: 'Liberia', currency_code: 'LRD', is_schengen: false },
  { country_code: 'LY', country_code_3: 'LBY', country_name: 'Libya', currency_code: 'LYD', is_schengen: false },
  { country_code: 'LI', country_code_3: 'LIE', country_name: 'Liechtenstein', currency_code: 'CHF', is_schengen: true },
  { country_code: 'LT', country_code_3: 'LTU', country_name: 'Lithuania', currency_code: 'EUR', is_schengen: true },
  { country_code: 'LU', country_code_3: 'LUX', country_name: 'Luxembourg', currency_code: 'EUR', is_schengen: true },
  { country_code: 'MG', country_code_3: 'MDG', country_name: 'Madagascar', currency_code: 'MGA', is_schengen: false },
  { country_code: 'MW', country_code_3: 'MWI', country_name: 'Malawi', currency_code: 'MWK', is_schengen: false },
  { country_code: 'MY', country_code_3: 'MYS', country_name: 'Malaysia', currency_code: 'MYR', is_schengen: false },
  { country_code: 'MV', country_code_3: 'MDV', country_name: 'Maldives', currency_code: 'MVR', is_schengen: false },
  { country_code: 'ML', country_code_3: 'MLI', country_name: 'Mali', currency_code: 'XOF', is_schengen: false },
  { country_code: 'MT', country_code_3: 'MLT', country_name: 'Malta', currency_code: 'EUR', is_schengen: true },
  { country_code: 'MH', country_code_3: 'MHL', country_name: 'Marshall Islands', currency_code: 'USD', is_schengen: false },
  { country_code: 'MR', country_code_3: 'MRT', country_name: 'Mauritania', currency_code: 'MRU', is_schengen: false },
  { country_code: 'MU', country_code_3: 'MUS', country_name: 'Mauritius', currency_code: 'MUR', is_schengen: false },
  { country_code: 'MX', country_code_3: 'MEX', country_name: 'Mexico', currency_code: 'MXN', is_schengen: false },
  { country_code: 'FM', country_code_3: 'FSM', country_name: 'Micronesia', currency_code: 'USD', is_schengen: false },
  { country_code: 'MD', country_code_3: 'MDA', country_name: 'Moldova', currency_code: 'MDL', is_schengen: false },
  { country_code: 'MC', country_code_3: 'MCO', country_name: 'Monaco', currency_code: 'EUR', is_schengen: false },
  { country_code: 'MN', country_code_3: 'MNG', country_name: 'Mongolia', currency_code: 'MNT', is_schengen: false },
  { country_code: 'ME', country_code_3: 'MNE', country_name: 'Montenegro', currency_code: 'EUR', is_schengen: false },
  { country_code: 'MA', country_code_3: 'MAR', country_name: 'Morocco', currency_code: 'MAD', is_schengen: false },
  { country_code: 'MZ', country_code_3: 'MOZ', country_name: 'Mozambique', currency_code: 'MZN', is_schengen: false },
  { country_code: 'MM', country_code_3: 'MMR', country_name: 'Myanmar', currency_code: 'MMK', is_schengen: false },
  { country_code: 'NA', country_code_3: 'NAM', country_name: 'Namibia', currency_code: 'NAD', is_schengen: false },
  { country_code: 'NR', country_code_3: 'NRU', country_name: 'Nauru', currency_code: 'AUD', is_schengen: false },
  { country_code: 'NP', country_code_3: 'NPL', country_name: 'Nepal', currency_code: 'NPR', is_schengen: false },
  { country_code: 'NL', country_code_3: 'NLD', country_name: 'Netherlands', currency_code: 'EUR', is_schengen: true },
  { country_code: 'NZ', country_code_3: 'NZL', country_name: 'New Zealand', currency_code: 'NZD', is_schengen: false },
  { country_code: 'NI', country_code_3: 'NIC', country_name: 'Nicaragua', currency_code: 'NIO', is_schengen: false },
  { country_code: 'NE', country_code_3: 'NER', country_name: 'Niger', currency_code: 'XOF', is_schengen: false },
  { country_code: 'NG', country_code_3: 'NGA', country_name: 'Nigeria', currency_code: 'NGN', is_schengen: false },
  { country_code: 'MK', country_code_3: 'MKD', country_name: 'North Macedonia', currency_code: 'MKD', is_schengen: false },
  { country_code: 'NO', country_code_3: 'NOR', country_name: 'Norway', currency_code: 'NOK', is_schengen: true },
  { country_code: 'OM', country_code_3: 'OMN', country_name: 'Oman', currency_code: 'OMR', is_schengen: false },
  { country_code: 'PK', country_code_3: 'PAK', country_name: 'Pakistan', currency_code: 'PKR', is_schengen: false },
  { country_code: 'PW', country_code_3: 'PLW', country_name: 'Palau', currency_code: 'USD', is_schengen: false },
  { country_code: 'PA', country_code_3: 'PAN', country_name: 'Panama', currency_code: 'PAB', is_schengen: false },
  { country_code: 'PG', country_code_3: 'PNG', country_name: 'Papua New Guinea', currency_code: 'PGK', is_schengen: false },
  { country_code: 'PY', country_code_3: 'PRY', country_name: 'Paraguay', currency_code: 'PYG', is_schengen: false },
  { country_code: 'PE', country_code_3: 'PER', country_name: 'Peru', currency_code: 'PEN', is_schengen: false },
  { country_code: 'PH', country_code_3: 'PHL', country_name: 'Philippines', currency_code: 'PHP', is_schengen: false },
  { country_code: 'PL', country_code_3: 'POL', country_name: 'Poland', currency_code: 'PLN', is_schengen: true },
  { country_code: 'PT', country_code_3: 'PRT', country_name: 'Portugal', currency_code: 'EUR', is_schengen: true },
  { country_code: 'QA', country_code_3: 'QAT', country_name: 'Qatar', currency_code: 'QAR', is_schengen: false },
  { country_code: 'RO', country_code_3: 'ROU', country_name: 'Romania', currency_code: 'RON', is_schengen: false },
  { country_code: 'RU', country_code_3: 'RUS', country_name: 'Russia', currency_code: 'RUB', is_schengen: false },
  { country_code: 'RW', country_code_3: 'RWA', country_name: 'Rwanda', currency_code: 'RWF', is_schengen: false },
  { country_code: 'KN', country_code_3: 'KNA', country_name: 'Saint Kitts and Nevis', currency_code: 'XCD', is_schengen: false },
  { country_code: 'LC', country_code_3: 'LCA', country_name: 'Saint Lucia', currency_code: 'XCD', is_schengen: false },
  { country_code: 'VC', country_code_3: 'VCT', country_name: 'Saint Vincent and the Grenadines', currency_code: 'XCD', is_schengen: false },
  { country_code: 'WS', country_code_3: 'WSM', country_name: 'Samoa', currency_code: 'WST', is_schengen: false },
  { country_code: 'SM', country_code_3: 'SMR', country_name: 'San Marino', currency_code: 'EUR', is_schengen: false },
  { country_code: 'ST', country_code_3: 'STP', country_name: 'Sao Tome and Principe', currency_code: 'STN', is_schengen: false },
  { country_code: 'SA', country_code_3: 'SAU', country_name: 'Saudi Arabia', currency_code: 'SAR', is_schengen: false },
  { country_code: 'SN', country_code_3: 'SEN', country_name: 'Senegal', currency_code: 'XOF', is_schengen: false },
  { country_code: 'RS', country_code_3: 'SRB', country_name: 'Serbia', currency_code: 'RSD', is_schengen: false },
  { country_code: 'SC', country_code_3: 'SYC', country_name: 'Seychelles', currency_code: 'SCR', is_schengen: false },
  { country_code: 'SL', country_code_3: 'SLE', country_name: 'Sierra Leone', currency_code: 'SLL', is_schengen: false },
  { country_code: 'SG', country_code_3: 'SGP', country_name: 'Singapore', currency_code: 'SGD', is_schengen: false },
  { country_code: 'SK', country_code_3: 'SVK', country_name: 'Slovakia', currency_code: 'EUR', is_schengen: true },
  { country_code: 'SI', country_code_3: 'SVN', country_name: 'Slovenia', currency_code: 'EUR', is_schengen: true },
  { country_code: 'SB', country_code_3: 'SLB', country_name: 'Solomon Islands', currency_code: 'SBD', is_schengen: false },
  { country_code: 'SO', country_code_3: 'SOM', country_name: 'Somalia', currency_code: 'SOS', is_schengen: false },
  { country_code: 'ZA', country_code_3: 'ZAF', country_name: 'South Africa', currency_code: 'ZAR', is_schengen: false },
  { country_code: 'SS', country_code_3: 'SSD', country_name: 'South Sudan', currency_code: 'SSP', is_schengen: false },
  { country_code: 'ES', country_code_3: 'ESP', country_name: 'Spain', currency_code: 'EUR', is_schengen: true },
  { country_code: 'LK', country_code_3: 'LKA', country_name: 'Sri Lanka', currency_code: 'LKR', is_schengen: false },
  { country_code: 'SD', country_code_3: 'SDN', country_name: 'Sudan', currency_code: 'SDG', is_schengen: false },
  { country_code: 'SR', country_code_3: 'SUR', country_name: 'Suriname', currency_code: 'SRD', is_schengen: false },
  { country_code: 'SE', country_code_3: 'SWE', country_name: 'Sweden', currency_code: 'SEK', is_schengen: true },
  { country_code: 'CH', country_code_3: 'CHE', country_name: 'Switzerland', currency_code: 'CHF', is_schengen: true },
  { country_code: 'SY', country_code_3: 'SYR', country_name: 'Syria', currency_code: 'SYP', is_schengen: false },
  { country_code: 'TW', country_code_3: 'TWN', country_name: 'Taiwan', currency_code: 'TWD', is_schengen: false },
  { country_code: 'TJ', country_code_3: 'TJK', country_name: 'Tajikistan', currency_code: 'TJS', is_schengen: false },
  { country_code: 'TZ', country_code_3: 'TZA', country_name: 'Tanzania', currency_code: 'TZS', is_schengen: false },
  { country_code: 'TH', country_code_3: 'THA', country_name: 'Thailand', currency_code: 'THB', is_schengen: false },
  { country_code: 'TL', country_code_3: 'TLS', country_name: 'Timor-Leste', currency_code: 'USD', is_schengen: false },
  { country_code: 'TG', country_code_3: 'TGO', country_name: 'Togo', currency_code: 'XOF', is_schengen: false },
  { country_code: 'TO', country_code_3: 'TON', country_name: 'Tonga', currency_code: 'TOP', is_schengen: false },
  { country_code: 'TT', country_code_3: 'TTO', country_name: 'Trinidad and Tobago', currency_code: 'TTD', is_schengen: false },
  { country_code: 'TN', country_code_3: 'TUN', country_name: 'Tunisia', currency_code: 'TND', is_schengen: false },
  { country_code: 'TR', country_code_3: 'TUR', country_name: 'Turkey', currency_code: 'TRY', is_schengen: false },
  { country_code: 'TM', country_code_3: 'TKM', country_name: 'Turkmenistan', currency_code: 'TMT', is_schengen: false },
  { country_code: 'TV', country_code_3: 'TUV', country_name: 'Tuvalu', currency_code: 'AUD', is_schengen: false },
  { country_code: 'UG', country_code_3: 'UGA', country_name: 'Uganda', currency_code: 'UGX', is_schengen: false },
  { country_code: 'UA', country_code_3: 'UKR', country_name: 'Ukraine', currency_code: 'UAH', is_schengen: false },
  { country_code: 'AE', country_code_3: 'ARE', country_name: 'United Arab Emirates', currency_code: 'AED', is_schengen: false },
  { country_code: 'GB', country_code_3: 'GBR', country_name: 'United Kingdom', currency_code: 'GBP', is_schengen: false },
  { country_code: 'US', country_code_3: 'USA', country_name: 'United States', currency_code: 'USD', is_schengen: false },
  { country_code: 'UY', country_code_3: 'URY', country_name: 'Uruguay', currency_code: 'UYU', is_schengen: false },
  { country_code: 'UZ', country_code_3: 'UZB', country_name: 'Uzbekistan', currency_code: 'UZS', is_schengen: false },
  { country_code: 'VU', country_code_3: 'VUT', country_name: 'Vanuatu', currency_code: 'VUV', is_schengen: false },
  { country_code: 'VE', country_code_3: 'VEN', country_name: 'Venezuela', currency_code: 'VES', is_schengen: false },
  { country_code: 'VN', country_code_3: 'VNM', country_name: 'Vietnam', currency_code: 'VND', is_schengen: false },
  { country_code: 'YE', country_code_3: 'YEM', country_name: 'Yemen', currency_code: 'YER', is_schengen: false },
  { country_code: 'ZM', country_code_3: 'ZMB', country_name: 'Zambia', currency_code: 'ZMW', is_schengen: false },
  { country_code: 'ZW', country_code_3: 'ZWE', country_name: 'Zimbabwe', currency_code: 'ZWL', is_schengen: false },
];

@Injectable()
export class CountriesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findAll(): Promise<Country[]> {
    const { data, error } = await this.supabase
      .from('countries')
      .select('*')
      .order('country_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch countries: ${error.message}`);
    }

    return data ?? [];
  }

  async findSchengen(): Promise<Country[]> {
    const { data, error } = await this.supabase
      .from('countries')
      .select('*')
      .eq('is_schengen', true)
      .order('country_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch Schengen countries: ${error.message}`);
    }

    return data ?? [];
  }

  async seedCountries(): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < ALL_COUNTRIES.length; i += batchSize) {
      const batch = ALL_COUNTRIES.slice(i, i + batchSize);
      const { data, error } = await this.supabase
        .from('countries')
        .upsert(batch, { onConflict: 'country_code', ignoreDuplicates: false })
        .select('country_code');

      if (error) {
        throw new Error(`Failed to seed countries batch: ${error.message}`);
      }

      inserted += data?.length ?? 0;
    }

    skipped = ALL_COUNTRIES.length - inserted;

    return { inserted, skipped };
  }
}
