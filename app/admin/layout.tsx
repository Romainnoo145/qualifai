'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
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
  const [mounted, setMounted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    dispatchTokenChanged();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = normalizeAdminToken(tokenInput);
    if (!candidate) {
      setLoginError('Voer een token in.');
      return;
    }
    setIsVerifying(true);
    try {
      const isValid = await verifyAdminToken(candidate);
      if (!isValid) {
        setLoginError('Token ongeldig.');
        return;
      }
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, candidate);
      setTokenInput('');
      setLoginError(null);
      dispatchTokenChanged();
    } catch {
      setLoginError('Kon token niet verifiëren. Probeer opnieuw.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--color-background)]" aria-hidden />
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] space-y-12">
          <div className="flex flex-col items-center space-y-7">
            <img
              src="/klarifai-logo.svg"
              alt="Klarifai"
              className="h-12 w-12"
            />
            <div className="text-center space-y-3">
              <p className="font-['Sora'] text-[11px] font-medium tracking-[0.18em] uppercase text-[var(--color-muted)]">
                <span style={{ color: '#e1c33c' }}>[ 01 ]</span>
                <span className="ml-2.5">ADMIN</span>
              </p>
              <h1 className="font-['Sora'] text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
                Welkom terug<span style={{ color: '#e1c33c' }}>.</span>
              </h1>
              <p className="text-[13px] font-normal text-[var(--color-muted-dark)]">
                Voer je account-token in om door te gaan.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••••••••••"
              disabled={isVerifying}
              className="input-minimal w-full text-center text-[14px] tracking-[0.05em]"
            />
            <button
              type="submit"
              disabled={isVerifying || !tokenInput}
              className="w-full rounded-md bg-[var(--color-gold)] px-4 py-3 text-[14px] font-semibold text-[var(--color-ink)] transition-opacity hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {isVerifying ? 'Verifiëren…' : 'Inloggen'}
            </button>
            {loginError ? (
              <p className="text-center text-[12px] font-normal text-[var(--color-brand-danger)]">
                {loginError}
              </p>
            ) : null}
          </form>

          <div className="flex flex-col items-center space-y-4 pt-2">
            <div className="h-px w-12 bg-[var(--color-border)]" />
            <Link
              href="/voorstel/maintix"
              className="group inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[0.02em] text-[var(--color-muted-dark)] transition-colors hover:text-[var(--color-ink)]"
            >
              Bekijk een live demo
              <span
                className="inline-block transition-transform group-hover:translate-x-0.5"
                style={{ color: '#e1c33c' }}
              >
                →
              </span>
            </Link>
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
          className="mb-5 flex h-8 w-8 items-center justify-center"
        >
          <img src="/klarifai-logo.svg" alt="Klarifai" className="h-7 w-7" />
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
