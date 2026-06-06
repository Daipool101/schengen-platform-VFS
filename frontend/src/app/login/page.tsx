'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Globe, Eye, EyeOff, LogIn } from 'lucide-react';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { token } = await login(email, password);
      localStorage.setItem('auth_token', token);
      router.push('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message ||
          'Invalid credentials. Please check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-130px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-xl shadow-xl border border-vfs-border overflow-hidden">
          {/* Card Header */}
          <div className="bg-vfs-navy px-8 py-7 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-vfs-red mb-4">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Schengen Visa Intelligence</h1>
            <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-vfs-text mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full border border-vfs-border rounded-lg px-4 py-3 text-sm text-vfs-text placeholder-gray-400 focus:outline-none focus:border-vfs-red focus:ring-1 focus:ring-vfs-red transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-vfs-text mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full border border-vfs-border rounded-lg px-4 py-3 pr-11 text-sm text-vfs-text placeholder-gray-400 focus:outline-none focus:border-vfs-red focus:ring-1 focus:ring-vfs-red transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-vfs-red hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-vfs-red transition-colors"
              >
                ← Back to Route Search
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          This platform is for authorised use only.
        </p>
      </div>
    </div>
  );
}
