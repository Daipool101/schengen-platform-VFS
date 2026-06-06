'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';

interface Step {
  label: string;
  status: 'done' | 'active' | 'pending';
}

const STEPS = [
  'Route found in database',
  'Fetching from official sources...',
  'Extracting visa data...',
  'Saving to database...',
];

export default function LoadingState() {
  const [activeStep, setActiveStep] = useState(1);
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        const next = prev < STEPS.length - 1 ? prev + 1 : prev;
        return next;
      });
      setProgress((prev) => {
        const next = prev + 18;
        return next > 90 ? 90 : next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const steps: Step[] = STEPS.map((label, i) => ({
    label,
    status: i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending',
  }));

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4 py-12">
      <div className="bg-white rounded-xl border border-vfs-border shadow-lg p-8 w-full max-w-md text-center">
        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-vfs-border" />
            <div className="absolute inset-0 rounded-full border-4 border-vfs-red border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-vfs-red/10 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-vfs-red animate-spin" />
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-vfs-text mb-1">
          Fetching Visa Intelligence
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          This usually takes 30–60 seconds for new routes.
        </p>

        {/* Steps */}
        <div className="space-y-3 mb-6 text-left">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {step.status === 'done' ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : step.status === 'active' ? (
                <Loader2 className="w-5 h-5 text-vfs-red flex-shrink-0 animate-spin" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
              )}
              <span
                className={`text-sm ${
                  step.status === 'done'
                    ? 'text-green-700 font-medium'
                    : step.status === 'active'
                    ? 'text-vfs-red font-semibold'
                    : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-vfs-border rounded-full h-2 overflow-hidden">
          <div
            className="h-2 bg-vfs-red rounded-full transition-all duration-[1500ms] ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">Please don&apos;t close this page</p>
      </div>
    </div>
  );
}
