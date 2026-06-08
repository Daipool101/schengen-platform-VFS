/**
 * India → Schengen VFS Knowledge Base
 * -----------------------------------
 * VFS Global operates Visa Application Centres (VACs) across India on behalf of
 * the Schengen embassies. Because the VFS website is a JavaScript app whose VAC
 * lists and fee tables are NOT exposed in scrapable HTML, this file provides the
 * reliable India-specific baseline (same approach as the Schengen doc checklist).
 *
 * ⚠️ VFS EMPLOYEE: verify the service fee against the official VFS fee table and
 *    update SERVICE_FEE_INR below if it changes. The VAC city list is stable.
 */

// ─── VFS service fee charged in India for a Schengen short-stay application ──
// This is the VFS logistics/service charge (separate from the €90 consular fee).
// Approximate current value — VERIFY against VFS before relying on it.
export const INDIA_VFS_SERVICE_FEE_INR = 1950;
export const INDIA_VFS_SERVICE_FEE_CURRENCY = 'INR';

export interface IndiaVacCenter {
  center_name: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  working_hours: string | null;
}

// ─── Major VFS Global Visa Application Centres in India ──────────────────────
// These metros host Schengen VACs for virtually all Schengen countries.
export const INDIA_VAC_CENTERS: IndiaVacCenter[] = [
  {
    center_name: 'VFS Global Visa Application Centre – New Delhi',
    city: 'New Delhi',
    address: 'Shivaji Stadium / Connaught Place area, New Delhi',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Mumbai',
    city: 'Mumbai',
    address: 'Andheri / Trade Centre area, Mumbai, Maharashtra',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Chennai',
    city: 'Chennai',
    address: 'Chennai, Tamil Nadu',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Kolkata',
    city: 'Kolkata',
    address: 'Kolkata, West Bengal',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Bengaluru',
    city: 'Bengaluru',
    address: 'Bengaluru, Karnataka',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Hyderabad',
    city: 'Hyderabad',
    address: 'Hyderabad, Telangana',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Ahmedabad',
    city: 'Ahmedabad',
    address: 'Ahmedabad, Gujarat',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Pune',
    city: 'Pune',
    address: 'Pune, Maharashtra',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Chandigarh',
    city: 'Chandigarh',
    address: 'Chandigarh',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
  {
    center_name: 'VFS Global Visa Application Centre – Kochi',
    city: 'Kochi',
    address: 'Kochi, Kerala',
    phone: null,
    email: null,
    working_hours: 'Monday to Friday (submission hours vary by embassy)',
  },
];
