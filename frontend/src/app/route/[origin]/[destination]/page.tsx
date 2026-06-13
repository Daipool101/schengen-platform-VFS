'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  Info,
  Shield,
  Syringe,
  CreditCard,
  Calendar,
  ExternalLink,
  Building2,
} from 'lucide-react';
import { searchRoute } from '@/lib/api';
import { RouteSearchResult, VisaDocument, VacCenter, TravelAdvisory } from '@/lib/types';
import LoadingState from '@/components/ui/LoadingState';
import FreshnessIndicator from '@/components/results/FreshnessIndicator';
import VisaTypesSection from '@/components/results/VisaTypesSection';

const NA = <span className="text-gray-400 italic text-sm">Information not available</span>;

function safeStr(val: string | null | undefined): React.ReactNode {
  if (val === null || val === undefined || val === '') return NA;
  return val;
}

function safeNum(val: number | null | undefined, suffix?: string): React.ReactNode {
  if (val === null || val === undefined) return NA;
  return `${val}${suffix || ''}`;
}

// Parses the [VFS]/[STD] source prefix the backend adds to notes.
function parseDocSource(notes: string | null): {
  source: 'vfs' | 'std' | null;
  cleanNotes: string | null;
} {
  if (!notes) return { source: null, cleanNotes: null };
  const m = notes.match(/^\[(VFS|STD)\]\s*/i);
  if (!m) return { source: null, cleanNotes: notes };
  const source = m[1].toUpperCase() === 'VFS' ? 'vfs' : 'std';
  const cleanNotes = notes.slice(m[0].length).trim() || null;
  return { source, cleanNotes };
}

function SourceBadge({ source }: { source: 'vfs' | 'std' }) {
  if (source === 'vfs') {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 border border-green-200 rounded px-1.5 py-0.5">
        VFS
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5"
      title="Standard Schengen requirement — verify with VFS"
    >
      Standard
    </span>
  );
}

// ── Expandable document row ──────────────────────────────────────────────────
function DocumentRow({ doc }: { doc: VisaDocument }) {
  const [open, setOpen] = useState(false);
  const { source, cleanNotes } = parseDocSource(doc.notes);
  const hasExtra = cleanNotes || doc.validity_notes;

  return (
    <div className="border border-vfs-border rounded-lg overflow-hidden">
      <div
        className={`flex items-start gap-3 px-4 py-3 ${hasExtra ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={() => hasExtra && setOpen(!open)}
      >
        {doc.is_mandatory ? (
          <CheckSquare className="w-4 h-4 text-vfs-red flex-shrink-0 mt-0.5" />
        ) : (
          <Square className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="text-sm font-medium text-vfs-text">{doc.document_name}</p>
          {source && <SourceBadge source={source} />}
        </div>
        {hasExtra && (
          <button className="text-gray-400">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>
      {open && hasExtra && (
        <div className="px-4 pb-3 pt-0 bg-gray-50 border-t border-vfs-border space-y-1">
          {cleanNotes && <p className="text-xs text-gray-600">{cleanNotes}</p>}
          {doc.validity_notes && (
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <Info className="w-3 h-3" /> {doc.validity_notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Advisory badge ────────────────────────────────────────────────────────────
function AdvisoryBadge({ type }: { type: string }) {
  const lower = type.toLowerCase();
  if (lower.includes('warning') || lower.includes('danger')) {
    return (
      <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-semibold uppercase">
        {type}
      </span>
    );
  }
  if (lower.includes('info') || lower.includes('notice')) {
    return (
      <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold uppercase">
        {type}
      </span>
    );
  }
  return (
    <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold uppercase">
      {type}
    </span>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const map = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 border px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[level]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {level.charAt(0).toUpperCase() + level.slice(1)} confidence
    </span>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-vfs-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-vfs-border flex items-center gap-2">
        {icon && <span className="text-vfs-red">{icon}</span>}
        <h2 className="text-base font-bold text-vfs-text">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ── Main Results Page ─────────────────────────────────────────────────────────
export default function RouteResultsPage() {
  const params = useParams();
  const origin = (params.origin as string).toUpperCase();
  const destination = (params.destination as string).toUpperCase();

  const [result, setResult] = useState<RouteSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRoute = useCallback(async () => {
    try {
      const resp = await searchRoute(origin, destination);

      if (resp.status === 202) {
        // Crawling in progress — poll the route endpoint directly every 5s
        // (no separate /jobs endpoint needed)
        let attempts = 0;
        const maxAttempts = 36; // 3 minutes max

        const poll = setInterval(async () => {
          attempts++;

          if (attempts > maxAttempts) {
            clearInterval(poll);
            setError(
              'Data collection is taking longer than expected. Please go back and search again in a few minutes.'
            );
            setLoading(false);
            return;
          }

          try {
            const routeResp = await searchRoute(origin, destination);

            if (routeResp.status === 200) {
              const data = routeResp.data as RouteSearchResult;
              // Stop polling once the crawl resolves to a terminal state:
              // got data, visa-exempt, or confirmed unsupported by VFS.
              if (
                data.requirements ||
                data.status === 'unsupported' ||
                data.status === 'visa_exempt'
              ) {
                clearInterval(poll);
                setResult(data);
                setLoading(false);
              }
              // otherwise route row exists but crawl not done yet → keep polling
            }
            // 202 → still pending, keep polling
          } catch {
            // network blip — keep trying until maxAttempts
          }
        }, 5000);
      } else {
        setResult(resp.data as RouteSearchResult);
        setLoading(false);
      }
    } catch {
      setError('Unable to fetch visa information. Please try again later.');
      setLoading(false);
    }
  }, [origin, destination]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-xl border border-vfs-border shadow p-8">
          <AlertTriangle className="w-10 h-10 text-vfs-red mx-auto mb-3" />
          <h2 className="text-lg font-bold text-vfs-text mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-5">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-vfs-red text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            ← Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // ── Visa-exempt route: no visa required → show a clear banner instead ──
  if (result.status === 'visa_exempt' && result.visa_exempt) {
    const ve = result.visa_exempt;
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-5">
          <Link href="/" className="hover:text-vfs-red transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-vfs-text font-medium">
            {origin} → {destination}
          </span>
        </nav>

        {/* Header */}
        <div className="bg-vfs-navy text-white rounded-xl px-6 py-5 mb-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-2">
            {origin}
            <span className="mx-3 text-vfs-red">→</span>
            {destination}
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-green-900/40 border-green-600 text-green-300">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            No Visa Required
          </span>
        </div>

        {/* Big green banner */}
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8 text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            No Visa Required ✈️
          </h2>
          <p className="text-green-700 max-w-xl mx-auto">{ve.reason}</p>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-vfs-border rounded-xl p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">
              Maximum Stay
            </p>
            <p className="text-xl font-bold text-vfs-text">
              {ve.max_stay_days} days
            </p>
            <p className="text-xs text-gray-500 mt-1">
              within any {ve.period_days}-day period
            </p>
          </div>
          <div className="bg-white border border-vfs-border rounded-xl p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">
              Purpose
            </p>
            <p className="text-xl font-bold text-vfs-text">Tourism / Business</p>
            <p className="text-xs text-gray-500 mt-1">Short-stay visits</p>
          </div>
        </div>

        {/* Important notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">
                Important to know
              </p>
              <p className="text-sm text-amber-700 leading-relaxed">{ve.notes}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-vfs-red text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            ← Search Another Route
          </Link>
        </div>
      </div>
    );
  }

  // ── Route not supported by VFS → clear message (no fabricated data) ──
  if (result.status === 'unsupported') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-5">
          <Link href="/" className="hover:text-vfs-red transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-vfs-text font-medium">{origin} → {destination}</span>
        </nav>
        <div className="bg-white rounded-xl border border-vfs-border shadow p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Info className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-vfs-text mb-2">Not available on VFS Global</h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto mb-2">
            VFS Global does not publish visa information for{' '}
            <strong>{origin} → {destination}</strong>.
          </p>
          <p className="text-gray-500 text-xs max-w-md mx-auto mb-6">
            This route may be handled directly by the embassy/consulate or a government
            portal. Support for those sources is planned for a later phase.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-vfs-red text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            ← Search Another Route
          </Link>
        </div>
      </div>
    );
  }

  const { route, requirements, documents, vac_centers, advisories, converted_fee, visa_types } = result;

  const mandatory = documents
    .filter((d) => d.is_mandatory)
    .sort((a, b) => a.display_order - b.display_order);
  const optional = documents
    .filter((d) => !d.is_mandatory)
    .sort((a, b) => a.display_order - b.display_order);

  // When VFS provides official document checklist PDFs (per visa type), those
  // take priority — hide the standard EU fallback list.
  const hasVfsChecklist = (visa_types ?? []).some((v) => v.checklist_pdf_url);

  const isOpen = route.is_application_allowed;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-5">
        <Link href="/" className="hover:text-vfs-red transition-colors">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-vfs-text font-medium">
          {route.origin_country} → {route.destination_country}
        </span>
      </nav>

      {/* Route Header */}
      <div className="bg-vfs-navy text-white rounded-xl px-6 py-5 mb-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {route.origin_country}
              <span className="mx-3 text-vfs-red">→</span>
              {route.destination_country}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {/* Status badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  isOpen
                    ? 'bg-green-900/40 border-green-600 text-green-300'
                    : 'bg-red-900/40 border-red-600 text-red-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-green-400' : 'bg-red-400'}`} />
                {isOpen ? 'Applications Open' : 'Applications Suspended'}
              </span>

              {/* Application center */}
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-medium">
                <Building2 className="w-3.5 h-3.5" />
                {route.application_center || 'VFS Global'}
              </span>

              {/* Visa category — only shown when VFS provides one */}
              {route.visa_category && (
                <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-medium">
                  <CreditCard className="w-3.5 h-3.5" />
                  {route.visa_category}
                </span>
              )}
            </div>
          </div>

          {/* Freshness */}
          {requirements && (
            <div className="flex-shrink-0">
              <FreshnessIndicator
                lastVerifiedAt={requirements.last_verified_at}
                status={requirements.data_freshness_status}
              />
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visa Types & Fees (real VFS data, per visa category) */}
          {visa_types && visa_types.length > 0 && (
            <Section title="Visa Types & Fees" icon={<CreditCard className="w-4 h-4" />}>
              <VisaTypesSection visaTypes={visa_types} />
            </Section>
          )}

          {/* Section 1 — Visa Overview */}
          <Section title="Visa Overview" icon={<CreditCard className="w-4 h-4" />}>
            {requirements ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-vfs-gray rounded-lg p-4 border border-vfs-border">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                      Visa Fee
                    </p>
                    <p className="text-xl font-bold text-vfs-text">
                      {requirements.visa_fee !== null
                        ? `${requirements.visa_fee_currency} ${requirements.visa_fee}`
                        : 'N/A'}
                    </p>
                    {converted_fee && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        ≈ {converted_fee.currency} {converted_fee.amount.toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="bg-vfs-gray rounded-lg p-4 border border-vfs-border">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                      Service Fee
                    </p>
                    <p className="text-xl font-bold text-vfs-text">
                      {requirements.service_fee !== null
                        ? `${requirements.service_fee_currency} ${requirements.service_fee}`
                        : 'N/A'}
                    </p>
                  </div>

                  <div className="bg-vfs-gray rounded-lg p-4 border border-vfs-border col-span-2 sm:col-span-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                      Processing Time
                    </p>
                    {requirements.processing_time_min !== null || requirements.processing_time_max !== null ? (
                      <p className="text-xl font-bold text-vfs-text">
                        {requirements.processing_time_min ?? '?'}–{requirements.processing_time_max ?? '?'}{' '}
                        <span className="text-sm font-normal text-gray-500">days</span>
                      </p>
                    ) : (
                      NA
                    )}
                    {requirements.processing_time_notes && (
                      <p className="text-xs text-gray-500 mt-0.5">{requirements.processing_time_notes}</p>
                    )}
                  </div>
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2">
                  <ConfidenceBadge level={requirements.confidence_level} />
                </div>
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm">Visa requirement data not available.</p>
            )}
          </Section>

          {/* Section 2 — Required Documents */}
          <Section title="Required Documents" icon={<CheckSquare className="w-4 h-4" />}>
            {hasVfsChecklist ? (
              <div className="flex items-start gap-3 bg-vfs-gray border border-vfs-border rounded-lg p-4">
                <CheckSquare className="w-5 h-5 text-vfs-red flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-vfs-text">
                    Official VFS document checklists are available per visa type.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a visa type in <strong>Visa Types &amp; Fees</strong> above and download
                    its <strong>Document Checklist (PDF)</strong> for the exact, official list of
                    required documents.
                  </p>
                </div>
              </div>
            ) : documents.length === 0 ? (
              <p className="text-gray-400 italic text-sm">Document list not available.</p>
            ) : (
              <div className="space-y-5">
                {mandatory.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-vfs-red">
                        Mandatory
                      </span>
                      <span className="text-xs bg-vfs-red/10 text-vfs-red border border-vfs-red/20 rounded-full px-2 py-0.5 font-semibold">
                        {mandatory.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {mandatory.map((doc, i) => (
                        <DocumentRow key={i} doc={doc} />
                      ))}
                    </div>
                  </div>
                )}

                {optional.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Optional
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 font-semibold">
                        {optional.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {optional.map((doc, i) => (
                        <DocumentRow key={i} doc={doc} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Section 3 — Insurance & Health */}
          <Section title="Insurance & Health" icon={<Shield className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Insurance card */}
              <div className="border border-vfs-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-vfs-red" />
                    <span className="text-sm font-semibold text-vfs-text">Travel Insurance</span>
                  </div>
                  {!requirements || requirements.insurance_required === null ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-50 text-gray-500 border-gray-200">
                      Not specified
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        requirements.insurance_required
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {requirements.insurance_required ? 'Required' : 'Not Required'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {requirements?.insurance_required && requirements?.insurance_min_coverage
                    ? `Minimum coverage: €${requirements.insurance_min_coverage.toLocaleString()}`
                    : requirements?.insurance_required
                    ? 'Minimum coverage amount not specified'
                    : requirements?.insurance_required === false
                    ? 'No travel insurance requirement'
                    : 'Not published by VFS for this route'}
                </p>
              </div>

              {/* Vaccination card */}
              <div className="border border-vfs-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Syringe className="w-4 h-4 text-vfs-red" />
                    <span className="text-sm font-semibold text-vfs-text">Vaccination</span>
                  </div>
                  {!requirements || requirements.vaccination_required === null ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-50 text-gray-500 border-gray-200">
                      Not specified
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        requirements.vaccination_required
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {requirements.vaccination_required ? 'Required' : 'Not Required'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {requirements?.vaccination_notes
                    ? requirements.vaccination_notes
                    : 'Not published by VFS for this route.'}
                </p>
              </div>
            </div>
          </Section>

          {/* Section 4 — Eligibility & Requirements */}
          <Section title="Eligibility & Requirements" icon={<Info className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-vfs-gray rounded-lg border border-vfs-border">
                  <Calendar className="w-4 h-4 text-vfs-red flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                      Min. Passport Validity
                    </p>
                    <p className="text-sm text-vfs-text">
                      {requirements?.min_passport_validity_days
                        ? `${requirements.min_passport_validity_days} days`
                        : 'Information not available'}
                    </p>
                  </div>
                </div>
              </div>

              {requirements?.eligibility_notes ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Eligibility Notes
                  </p>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    {requirements.eligibility_notes}
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm">Eligibility notes not available.</p>
              )}
            </div>
          </Section>

          {/* Section 6 — Travel Advisories */}
          <Section title="Travel Advisories" icon={<AlertTriangle className="w-4 h-4" />}>
            {advisories.length === 0 ? (
              <div className="flex items-center gap-3 py-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-vfs-text">No current advisories</p>
                  <p className="text-xs text-gray-500">No travel warnings or advisories for this route.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {advisories.map((adv: TravelAdvisory, i: number) => (
                  <div key={i} className="border border-vfs-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <AdvisoryBadge type={adv.advisory_type} />
                        <span className="text-sm font-semibold text-vfs-text">{adv.title}</span>
                      </div>
                      {adv.effective_date && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {new Date(adv.effective_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{adv.description}</p>
                    {adv.source_url && (
                      <a
                        href={adv.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-vfs-red hover:underline"
                      >
                        Source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="space-y-6">
          {/* Section 5 — VAC Centers */}
          <Section title="VAC Centers" icon={<MapPin className="w-4 h-4" />}>
            {vac_centers.length === 0 ? (
              <p className="text-gray-400 italic text-sm">VAC center information not available.</p>
            ) : (
              <div className="space-y-4">
                {vac_centers.map((center: VacCenter, i: number) => (
                  <div key={i} className="border border-vfs-border rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-vfs-red flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-vfs-text">{center.center_name}</p>
                        <p className="text-xs text-gray-500 font-medium">{center.city}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-600 pl-6">
                      {center.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400" />
                          {/^https?:\/\//.test(center.address) ? (
                            <a
                              href={center.address}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-vfs-red hover:underline font-medium"
                            >
                              View on Google Maps →
                            </a>
                          ) : (
                            <span>{center.address}</span>
                          )}
                        </div>
                      )}
                      {center.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{center.phone}</span>
                        </div>
                      )}
                      {center.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span className="truncate">{center.email}</span>
                        </div>
                      )}
                      {center.working_hours && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{center.working_hours}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
