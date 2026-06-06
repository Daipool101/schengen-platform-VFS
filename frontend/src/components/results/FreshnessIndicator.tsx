import { Clock } from 'lucide-react';

interface FreshnessIndicatorProps {
  lastVerifiedAt: string | null;
  status: 'fresh' | 'stale' | 'unknown';
}

function getAgeLabel(lastVerifiedAt: string | null): string {
  if (!lastVerifiedAt) return 'Unknown';
  const date = new Date(lastVerifiedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// Formats a timestamp as DD-MM-YYYY (e.g. 06-06-2026)
function getFormattedDate(lastVerifiedAt: string | null): string | null {
  if (!lastVerifiedAt) return null;
  const date = new Date(lastVerifiedAt);
  if (isNaN(date.getTime())) return null;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const config = {
  fresh: {
    dot: 'bg-green-500',
    text: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    label: 'Fresh',
  },
  stale: {
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    label: 'Verify before use',
  },
  unknown: {
    dot: 'bg-gray-400',
    text: 'text-gray-600',
    bg: 'bg-gray-50 border-gray-200',
    label: 'Unknown',
  },
};

export default function FreshnessIndicator({
  lastVerifiedAt,
  status,
}: FreshnessIndicatorProps) {
  const c = config[status] || config.unknown;
  const ageLabel = getAgeLabel(lastVerifiedAt);
  const formattedDate = getFormattedDate(lastVerifiedAt);

  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      {/* Status pill with relative age */}
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${c.bg} ${c.text}`}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
        <Clock className="w-3 h-3" />
        <span>
          {c.label} · {ageLabel}
        </span>
      </div>

      {/* Explicit verification date — DD-MM-YYYY */}
      {formattedDate && (
        <span className="text-xs font-semibold text-white/90 bg-white/10 border border-white/20 rounded px-2 py-0.5">
          Last verified on {formattedDate}
        </span>
      )}
    </div>
  );
}
