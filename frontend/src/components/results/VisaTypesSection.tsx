'use client';

import { useState } from 'react';
import {
  CreditCard,
  FileText,
  Clock,
  Camera,
  FileCheck,
  Download,
  Layers,
} from 'lucide-react';
import { VisaType } from '@/lib/types';

export default function VisaTypesSection({ visaTypes }: { visaTypes: VisaType[] }) {
  const [selectedId, setSelectedId] = useState<string>(visaTypes[0]?.id ?? '');

  if (!visaTypes || visaTypes.length === 0) {
    return (
      <p className="text-gray-400 italic text-sm">
        Visa type information not available for this route.
      </p>
    );
  }

  const selected = visaTypes.find((v) => v.id === selectedId) ?? visaTypes[0];

  // Group by category for the selector
  const categories = Array.from(new Set(visaTypes.map((v) => v.category || 'Visa')));

  return (
    <div className="space-y-5">
      {/* Selector — grouped chips */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              {cat}
            </p>
            <div className="flex flex-wrap gap-2">
              {visaTypes
                .filter((v) => (v.category || 'Visa') === cat)
                .map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      v.id === selected.id
                        ? 'bg-vfs-red text-white border-vfs-red'
                        : 'bg-white text-vfs-text border-vfs-border hover:border-vfs-red'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected visa type detail */}
      <div className="border border-vfs-border rounded-xl overflow-hidden">
        <div className="bg-vfs-navy text-white px-5 py-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-vfs-red" />
          <span className="font-bold">{selected.name}</span>
          <span className="text-xs bg-white/10 border border-white/20 rounded-full px-2 py-0.5 ml-1">
            {selected.category}
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Visa Fees */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-vfs-red" />
              <h4 className="text-sm font-bold text-vfs-text">Visa Fees</h4>
            </div>
            {selected.visa_type_fees && selected.visa_type_fees.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-vfs-border rounded-lg overflow-hidden">
                  <thead className="bg-vfs-gray">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Visa Type</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Fee (INR)</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">Fee (EUR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selected.visa_type_fees]
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((f, i) => (
                        <tr key={i} className="border-t border-vfs-border">
                          <td className="px-3 py-2 text-vfs-text">{f.fee_label}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {f.fee_inr != null ? `₹${f.fee_inr.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {f.fee_eur != null ? `€${f.fee_eur}` : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Fee table not published by VFS for this type.
              </p>
            )}
          </div>

          {/* VFS Service Fee */}
          {(selected.service_fee != null || selected.service_fee_note) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-0.5">
                VFS Service Charge
              </p>
              <p className="text-sm text-amber-900">
                {selected.service_fee != null
                  ? `${selected.service_fee_currency || 'INR'} ${selected.service_fee.toLocaleString()}`
                  : ''}
              </p>
              {selected.service_fee_note && (
                <p className="text-xs text-amber-700 mt-0.5">{selected.service_fee_note}</p>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selected.processing_time && (
              <InfoCard icon={<Clock className="w-4 h-4" />} label="Processing Time" value={selected.processing_time} />
            )}
            {selected.photo_specifications && (
              <InfoCard icon={<Camera className="w-4 h-4" />} label="Photo Specifications" value={selected.photo_specifications} />
            )}
          </div>

          {/* Downloads */}
          <div className="flex flex-wrap gap-2">
            {selected.checklist_pdf_url && (
              <a
                href={selected.checklist_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-vfs-red text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <FileCheck className="w-4 h-4" />
                Document Checklist (PDF)
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
            {selected.application_form_url && (
              <a
                href={selected.application_form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white border border-vfs-border text-vfs-text text-sm font-semibold px-4 py-2 rounded-lg hover:border-vfs-red transition-colors"
              >
                <FileText className="w-4 h-4" />
                Application Form (PDF)
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {selected.overview && (
            <p className="text-sm text-gray-600 leading-relaxed border-t border-vfs-border pt-3">
              {selected.overview}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-vfs-gray rounded-lg border border-vfs-border">
      <span className="text-vfs-red flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-vfs-text">{value}</p>
      </div>
    </div>
  );
}
