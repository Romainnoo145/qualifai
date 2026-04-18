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
  FileText,
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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center space-y-5">
            <div className="inline-flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-ink)] shadow-sm">
                <span className="font-['Sora'] text-xs font-bold tracking-tight text-[var(--color-gold-hi)]">
                  K
                </span>
              </div>
              <span className="font-['Sora'] text-xl font-bold tracking-tight text-[var(--color-ink)]">
                Qualifai
              </span>
            </div>

            <div>
              <p className="admin-eyebrow">Admin login</p>
              <p className="mt-2 text-[13px] font-normal text-[var(--color-muted-dark)]">
                Gebruik je account-token om in te loggen.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              {
                label: 'Klarifai',
                slug: 'klarifai',
                initials: 'KL',
                token: process.env.NEXT_PUBLIC_ADMIN_SECRET,
              },
              {
                label: "Atlantis · Europe's Gate",
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
                        setLoginError(`Token ongeldig voor ${account.label}.`);
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
                  className="flex w-full items-center gap-3.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3.5 text-left transition-colors hover:border-[var(--color-ink)] disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-ink)]">
                    <span className="font-['Sora'] text-[10px] font-bold text-[var(--color-gold-hi)]">
                      {account.initials}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                      {account.label}
                    </p>
                    <p className="mt-0.5 text-[10px] tracking-[0.08em] text-[var(--color-muted)]">
                      {account.slug}
                    </p>
                  </div>
                  <span className="text-[var(--color-muted)] text-xs">→</span>
                </button>
              ))}
          </div>
          {loginError ? (
            <p className="text-center text-[11px] text-[var(--color-brand-danger)]">
              {loginError}
            </p>
          ) : null}
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
    { href: '/admin/quotes', label: 'Offertes', icon: FileText },
    { href: '/admin/outreach', label: 'Draft Queue', icon: Mail },
    { href: '/admin/use-cases', label: 'Use Cases', icon: BookOpen },
    { href: '/admin/signals', label: 'Signals', icon: Zap },
  ];

  const activeProject =
    (projectsQuery.data?.projects ?? []).find(
      (project) => project.slug === projectsQuery.data?.activeProjectSlug,
    ) ?? projectsQuery.data?.projects?.[0];

  const accountLabel = activeProject?.name ?? 'Account';

  const RailItem = ({ item }: { item: NavItem }) => {
    const isActive =
      pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(item.href));
    return (
      <Link
        href={item.href}
        title={item.label}
        aria-label={item.label}
        className={cn(
          'group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors',
          isActive
            ? 'text-[var(--color-ink)]'
            : 'text-[var(--color-muted)] hover:bg-[rgba(10,10,46,0.06)] hover:text-[var(--color-ink)]',
        )}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute -left-[calc(theme(spacing.4)/2+3px)] top-2 bottom-2 w-[2px] rounded-full bg-[var(--color-gold)]"
            style={{ left: '-9px' }}
          />
        )}
        <item.icon className="h-[16px] w-[16px]" strokeWidth={1.75} />
        <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-[var(--radius-xs)] bg-[var(--color-ink)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-surface)] opacity-0 transition-opacity group-hover:opacity-100 lg:block">
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      <aside className="sticky top-0 hidden h-screen w-[58px] flex-shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-surface)] py-5 lg:flex">
        {/* Brand */}
        <Link
          href="/admin"
          aria-label="Qualifai"
          className="mb-5 flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--color-ink)] shadow-sm"
        >
          <span className="font-['Sora'] text-[13px] font-bold tracking-tight text-[var(--color-gold-hi)]">
            K
          </span>
        </Link>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1">
          {navItems.map((item) => (
            <RailItem key={item.href} item={item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <button
            onClick={onLogout}
            title={`Uitloggen · ${accountLabel}`}
            aria-label="Uitloggen"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[rgba(10,10,46,0.06)] hover:text-[var(--color-brand-danger)]"
          >
            <LogOut className="h-[14px] w-[14px]" strokeWidth={1.75} />
          </button>
          <div
            title={`Romano · ${accountLabel}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-ink)]"
          >
            <span className="font-['Sora'] text-[10px] font-bold text-[var(--color-gold-hi)]">
              RK
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — kept for <lg. Desktop has no topbar. */}
        <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)] px-5 lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-ink)]">
              <span className="font-['Sora'] text-[11px] font-bold text-[var(--color-gold-hi)]">
                K
              </span>
            </div>
            <span className="font-['Sora'] text-[15px] font-bold tracking-tight">
              Qualifai
            </span>
          </div>
          <button
            onClick={onLogout}
            aria-label="Uitloggen"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
            {children}
          </div>
        </main>
      </div>
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
