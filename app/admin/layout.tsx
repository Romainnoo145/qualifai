'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Plus, LogOut } from 'lucide-react';

function AdminAuth({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin-token');
    }
    return null;
  });
  const [input, setInput] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('admin-token', input);
    setToken(input);
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('admin-token');
    setToken(null);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="glass-card p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold font-heading text-slate-900">
              Klarifai Discover
            </h1>
            <p className="text-sm text-slate-500 mt-1">Admin Access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter admin token"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-klarifai-yellow/50 focus:border-klarifai-yellow"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 rounded-lg text-sm font-semibold bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminShell onLogout={handleLogout}>{children}</AdminShell>;
}

function AdminShell({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/prospects', label: 'Prospects', icon: Users },
    { href: '/admin/prospects/new', label: 'New Prospect', icon: Plus },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-klarifai-midnight flex items-center justify-center">
                <span className="text-klarifai-yellow font-bold text-xs">
                  K
                </span>
              </div>
              <span className="font-heading font-bold text-slate-900">
                Discover
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuth>{children}</AdminAuth>;
}
