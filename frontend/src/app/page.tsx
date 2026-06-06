'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Select from 'react-select';
import { Search, Globe, Shield, Clock, FileText } from 'lucide-react';
import { getCountries } from '@/lib/api';
import { Country } from '@/lib/types';

interface SelectOption {
  value: string;
  label: string;
}

export default function HomePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [origin, setOrigin] = useState<SelectOption | null>(null);
  const [destination, setDestination] = useState<SelectOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingCountries, setFetchingCountries] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCountries()
      .then((data) => setCountries(data))
      .catch(() => {
        // Use fallback countries if API unavailable
        setCountries([]);
      })
      .finally(() => setFetchingCountries(false));
  }, []);

  const countryOptions: SelectOption[] = countries.map((c) => ({
    value: c.country_code,
    label: c.country_name,
  }));

  const handleSearch = () => {
    if (!origin || !destination) {
      setError('Please select both origin and destination countries.');
      return;
    }
    if (origin.value === destination.value) {
      setError('Origin and destination cannot be the same country.');
      return;
    }
    setError('');
    setLoading(true);
    router.push(`/route/${origin.value}/${destination.value}`);
  };

  const features = [
    {
      icon: <FileText className="w-5 h-5 text-vfs-red" />,
      title: 'Required Documents',
      desc: 'Complete mandatory and optional document checklists',
    },
    {
      icon: <Clock className="w-5 h-5 text-vfs-red" />,
      title: 'Processing Times',
      desc: 'Accurate visa processing and appointment timelines',
    },
    {
      icon: <Shield className="w-5 h-5 text-vfs-red" />,
      title: 'Insurance & Health',
      desc: 'Travel insurance requirements and vaccination rules',
    },
    {
      icon: <Globe className="w-5 h-5 text-vfs-red" />,
      title: 'VAC Centers',
      desc: 'Nearest Visa Application Centre locations and hours',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-130px)] flex flex-col">
      {/* Hero */}
      <div className="bg-vfs-navy text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-vfs-red/20 border border-vfs-red/40 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-vfs-red animate-pulse" />
            <span className="text-sm text-red-300 font-medium">
              Real-time Schengen Visa Intelligence
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            Schengen Visa Route Search
          </h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto leading-relaxed">
            Enter your origin and destination country to get complete visa information —
            fees, documents, processing times, and more.
          </p>
        </div>
      </div>

      {/* Search Card */}
      <div className="max-w-3xl mx-auto w-full px-4 -mt-8">
        <div className="bg-white rounded-xl shadow-xl border border-vfs-border p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-semibold text-vfs-text mb-1.5">
                Travelling From
              </label>
              <Select
                options={countryOptions}
                value={origin}
                onChange={(v) => setOrigin(v)}
                placeholder={fetchingCountries ? 'Loading countries...' : 'Select country...'}
                isDisabled={fetchingCountries}
                isSearchable
                classNamePrefix="react-select"
                noOptionsMessage={() => 'No countries found'}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-vfs-text mb-1.5">
                Travelling To
              </label>
              <Select
                options={countryOptions}
                value={destination}
                onChange={(v) => setDestination(v)}
                placeholder={fetchingCountries ? 'Loading countries...' : 'Select country...'}
                isDisabled={fetchingCountries}
                isSearchable
                classNamePrefix="react-select"
                noOptionsMessage={() => 'No countries found'}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading || fetchingCountries}
            className="w-full bg-vfs-red hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search Visa Requirements
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            Data sourced from VFS Global and official government portals
          </p>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="max-w-3xl mx-auto w-full px-4 py-10">
        <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">
          What you&apos;ll get
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-lg border border-vfs-border p-4 text-center hover:shadow-md transition-shadow"
            >
              <div className="flex justify-center mb-2">{f.icon}</div>
              <p className="text-sm font-semibold text-vfs-text mb-1">{f.title}</p>
              <p className="text-xs text-gray-500 leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
