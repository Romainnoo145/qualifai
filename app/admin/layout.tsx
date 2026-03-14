'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Zap,
  Mail,
  LogOut,
  FolderKanban,
  BookOpen,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/components/providers';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  normalizeAdminToken,
} from '@/lib/admin-token';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function dispatchTokenChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('admin-token-changed'));
}

function getAdminTokenSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  const storedToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  const token = normalizeAdminToken(storedToken);

  if (!token) return null;
  if (storedToken !== token) {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  }

  return token;
}

function subscribeAdminToken(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_TOKEN_STORAGE_KEY) onStoreChange();
  };
  const onLocalChange = () => onStoreChange();

  window.addEventListener('storage', onStorage);
  window.addEventListener('admin-token-changed', onLocalChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('admin-token-changed', onLocalChange);
  };
}

async function verifyAdminToken(token: string): Promise<boolean> {
  const response = await fetch('/api/trpc/projects.list?batch=1&input=%7B%7D', {
    headers: { 'x-admin-token': token },
    cache: 'no-store',
  });
  return response.ok;
}

function AdminAuth({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(
    subscribeAdminToken,
    getAdminTokenSnapshot,
    () => null,
  );
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    dispatchTokenChanged();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <aside className="relative overflow-hidden rounded-3xl bg-[#040026] p-8 text-white shadow-2xl shadow-[#040026]/15 sm:p-10">
            <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-[#EBCB4B]/15 blur-2xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-10">
              <div>
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EBCB4B] text-[#040026]">
                    <span className="text-xs font-black tracking-tight">K</span>
                  </div>
                  <span className="text-sm font-black tracking-wide">
                    Qualifai Admin
                  </span>
                </div>

                <h1 className="mt-8 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                  Sales Intelligence Control Center
                </h1>
                <p className="mt-4 max-w-md text-sm font-medium text-white/80 sm:text-base">
                  Zelfde engine, account-gebonden toegang. Je ziet alleen
                  bedrijven en use cases binnen jouw login-scope.
                </p>
              </div>

              <div className="relative z-10 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-[#EBCB4B]" />
                  <div>
                    <p className="text-sm font-bold">
                      Scope beveiliging actief
                    </p>
                    <p className="mt-1 text-xs text-white/80">
                      Projectgrenzen worden server-side afgedwongen op basis van
                      je token.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-10">
            <div className="w-full max-w-sm space-y-7">
              <div className="text-center">
                <h2 className="text-2xl font-black tracking-tight text-[#040026]">
                  Admin Login
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Gebruik je account-token om in te loggen
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'Klarifai',
                    slug: 'klarifai',
                    initials: 'KL',
                    token: process.env.NEXT_PUBLIC_ADMIN_SECRET,
                  },
                  {
                    label: "Atlantis (Europe's Gate)",
                    slug: 'europes-gate',
                    initials: 'AT',
                    token: process.env.NEXT_PUBLIC_ATLANTIS_ADMIN_SECRET,
                  },
                ]
                  .filter((a) => a.token)
                  .map((account) => (
                    <button
                      key={account.slug}
                      onClick={async () => {
                        if (isVerifying || !account.token) return;
                        setIsVerifying(true);
                        try {
                          const isValid = await verifyAdminToken(account.token);
                          if (!isValid) {
                            setLoginError(
                              `Token ongeldig voor ${account.label}.`,
                            );
                            return;
                          }
                          localStorage.setItem(
                            ADMIN_TOKEN_STORAGE_KEY,
                            account.token,
                          );
                          setLoginError(null);
                          dispatchTokenChanged();
                        } catch {
                          setLoginError(
                            'Kon token niet verifiëren. Probeer opnieuw.',
                          );
                        } finally {
                          setIsVerifying(false);
                        }
                      }}
                      disabled={isVerifying}
                      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-all hover:border-[#040026]/30 hover:bg-white hover:shadow-md disabled:opacity-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#040026] shadow-sm">
                        <span className="text-xs font-black text-[#EBCB4B]">
                          {account.initials}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#040026]">
                          {account.label}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {account.slug}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-300">
                        →
                      </span>
                    </button>
                  ))}
              </div>
              {loginError ? (
                <p className="text-xs font-bold text-red-500">{loginError}</p>
              ) : null}
            </div>
          </section>
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

  const projectsQuery = api.projects.list.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (projectsQuery.error?.data?.code === 'UNAUTHORIZED') {
      onLogout();
    }
  }, [projectsQuery.error, onLogout]);

  const navItems: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/prospects', label: 'Companies', icon: Building2 },
    { href: '/admin/campaigns', label: 'Campaigns', icon: FolderKanban },
    { href: '/admin/outreach', label: 'Draft Queue', icon: Mail },
    { href: '/admin/use-cases', label: 'Use Cases', icon: BookOpen },
    { href: '/admin/signals', label: 'Signals', icon: Zap },
  ];

  const activeProject =
    (projectsQuery.data?.projects ?? []).find(
      (project) => project.slug === projectsQuery.data?.activeProjectSlug,
    ) ?? projectsQuery.data?.projects?.[0];

  const accountLabel = activeProject?.name ?? 'Account';

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive =
      pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(item.href));
    return (
      <Link
        href={item.href}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all',
          isActive
            ? 'bg-[#040026] text-white'
            : 'text-slate-500 hover:bg-slate-200/50 hover:text-[#040026]',
        )}
      >
        <item.icon
          className={cn(
            'h-4 w-4 transition-colors',
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
      <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r border-[#E9ECEF] bg-[#F8F9FA] lg:flex">
        <div className="flex items-center justify-between p-8 pb-4">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#040026] shadow-lg">
              <span className="text-xs font-bold tracking-tighter text-[#EBCB4B]">
                K
              </span>
            </div>
            <span className="text-xl font-black tracking-tight text-[#040026]">
              Qualifai
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-8">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="border-t border-slate-100 p-6">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#040026] shadow-sm">
              <span className="text-[10px] font-bold text-[#EBCB4B]">RA</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#040026]">
                Romano
              </p>
              <p className="truncate text-[10px] font-bold text-slate-400">
                {accountLabel}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="text-slate-300 transition-colors hover:text-red-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 lg:h-0 lg:border-none lg:px-0">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-xl bg-slate-50 p-2 text-[#040026]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-black text-[#040026]">Qualifai</span>
          </div>
          <div className="pointer-events-none hidden w-full items-center justify-between px-12 pt-8 opacity-0 lg:flex" />
        </header>

        <main className="flex-1 overflow-x-hidden pt-10 lg:pt-0">
          <div className="mx-auto max-w-7xl px-8 py-16 lg:px-20 lg:py-24">
            {children}
          </div>
        </main>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#040026]/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <div className="flex items-center justify-between p-8">
              <span className="font-black text-[#040026]">Qualifai</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-4">
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
            <div className="p-4 pt-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs font-bold text-[#040026]">Romano</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {accountLabel}
                </p>
              </div>
            </div>
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
