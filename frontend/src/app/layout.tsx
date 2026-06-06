import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Globe, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Schengen Visa Intelligence | Route Search Platform',
  description:
    'Get complete Schengen visa information for your travel route — requirements, documents, fees, and VAC centers.',
  keywords: 'Schengen visa, visa requirements, VFS Global, travel documents, visa fees',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-vfs-gray flex flex-col">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-vfs-red" />

        {/* Header */}
        <header className="bg-vfs-navy shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-3 group">
                <div className="flex items-center justify-center w-9 h-9 rounded bg-vfs-red">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-white font-bold text-sm tracking-wide uppercase">
                    Schengen Visa
                  </span>
                  <span className="text-vfs-red font-semibold text-xs tracking-widest uppercase">
                    Intelligence
                  </span>
                </div>
              </Link>

              {/* Nav */}
              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/"
                  className="text-gray-300 hover:text-white hover:bg-white/10 px-3 py-2 rounded text-sm font-medium transition-colors"
                >
                  Route Search
                </Link>
                <Link
                  href="/login"
                  className="ml-2 bg-vfs-red hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1"
                >
                  Sign In
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </nav>

              {/* Mobile nav */}
              <div className="flex md:hidden items-center gap-2">
                <Link
                  href="/login"
                  className="bg-vfs-red hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="bg-vfs-navy text-gray-400 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-vfs-red flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-300">
                  Schengen Visa Intelligence Platform
                </span>
              </div>
              <p className="text-xs text-center text-gray-500">
                Data sourced from official VFS Global and government portals. Always verify
                with official sources before travel.
              </p>
              <p className="text-xs text-gray-500">
                &copy; {new Date().getFullYear()} Schengen Intelligence
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
