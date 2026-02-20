'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Zap,
  Mail,
  LogOut,
  FolderKanban,
  Beaker,
  BookOpen,
  FileText,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function getAdminTokenSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin-token');
}

function subscribeAdminToken(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === 'admin-token') onStoreChange();
  };
  const onLocalChange = () => onStoreChange();

  window.addEventListener('storage', onStorage);
  window.addEventListener('admin-token-changed', onLocalChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('admin-token-changed', onLocalChange);
  };
}

function AdminAuth({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(
    subscribeAdminToken,
    getAdminTokenSnapshot,
    () => null,
  );
  const [input, setInput] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('admin-token', input);
    window.dispatchEvent(new Event('admin-token-changed'));
  };

  const handleLogout = () => {
    localStorage.removeItem('admin-token');
    window.dispatchEvent(new Event('admin-token-changed'));
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9FB] px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-[#040026] flex items-center justify-center mx-auto shadow-xl">
              <span className="text-[#EBCB4B] font-bold text-2xl tracking-tighter">
                K
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#040026]">
              Admin Access
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Precision Intelligence Engine
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Secure Token
                </label>
                <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#040026]/5 focus:border-[#040026] transition-all"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-[#040026] text-white rounded-xl font-bold text-sm tracking-wide hover:opacity-90 transition-all"
              >
                Sign In
              </Button>
            </form>
          </div>
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    {
      group: 'Overview',
      items: [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/prospects', label: 'Companies', icon: Building2 },
        { href: '/admin/campaigns', label: 'Campaigns', icon: FolderKanban },
      ],
    },
    {
      group: 'Intelligence',
      items: [
        { href: '/admin/use-cases', label: 'Use Cases', icon: BookOpen },
        { href: '/admin/research', label: 'Research runs', icon: Beaker },
        { href: '/admin/briefs', label: 'Product Briefs', icon: FileText },
        { href: '/admin/signals', label: 'Signals feed', icon: Zap },
      ],
    },
    {
      group: 'Outreach',
      items: [
        { href: '/admin/contacts', label: 'Contacts', icon: Users },
        { href: '/admin/outreach', label: 'Draft Queue', icon: Mail },
      ],
    },
  ];

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive =
      pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(item.href));
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group',
          isActive
            ? 'bg-[#040026] text-white shadow-xl shadow-[#040026]/10'
            : 'text-slate-500 hover:text-[#040026] hover:bg-slate-200/50',
        )}
      >
        <item.icon
          className={cn(
            'w-4 h-4 transition-colors',
            isActive
              ? 'text-[#EBCB4B]'
              : 'text-slate-400 group-hover:text-[#040026]',
          )}
        />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9F9FB] flex">
      {/* Fixed Sidebar - Apple style (Light) */}
      <aside className="hidden lg:flex w-72 h-screen sticky top-0 flex-col bg-[#F8F9FA] border-r border-[#E9ECEF]">
        <div className="p-8 pb-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#040026] flex items-center justify-center shadow-lg">
              <span className="text-[#EBCB4B] font-bold text-xs tracking-tighter">
                K
              </span>
            </div>
            <span className="font-black text-xl tracking-tight text-[#040026]">
              Qualifai
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-10">
          {navItems.map((group) => (
            <div key={group.group} className="space-y-2">
              <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                {group.group}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-[#040026] flex items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold text-[#EBCB4B]">RA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#040026] truncate">
                Romano
              </p>
              <p className="text-[10px] text-slate-400 font-bold truncate">
                Admin
              </p>
            </div>
            <button
              onClick={onLogout}
              className="text-slate-300 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 lg:h-0 flex items-center justify-between px-6 lg:px-0 bg-white border-b border-slate-200 lg:border-none">
          <div className="lg:hidden flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 rounded-xl bg-slate-50 text-[#040026]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-black text-[#040026]">Qualifai</span>
          </div>
          <div className="hidden lg:flex w-full px-12 pt-8 items-center justify-between pointer-events-none opacity-0"></div>
        </header>

        <main className="flex-1 overflow-x-hidden pt-10 lg:pt-0">
          <div className="max-w-7xl mx-auto px-8 py-16 lg:px-20 lg:py-24">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#040026]/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <div className="p-8 flex items-center justify-between">
              <span className="font-black text-[#040026]">Qualifai</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-4 space-y-6">
              {navItems.map((group) => (
                <div key={group.group} className="space-y-1">
                  <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    {group.group}
                  </p>
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
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
