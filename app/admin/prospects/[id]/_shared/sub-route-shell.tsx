'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/components/providers';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'evidence', label: 'Evidence' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'resultaten', label: 'Resultaten' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function SubRouteShell({
  active,
  children,
}: {
  active: TabKey;
  children: React.ReactNode;
}) {
  const params = useParams();
  const id = params.id as string;
  const pathname = usePathname();

  const prospectQuery = api.admin.getProspect.useQuery({ id });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prospectQuery.data as any;

  const displayName = p?.companyName ?? p?.domain ?? '…';
  const initial = (displayName || '?').charAt(0).toUpperCase();

  return (
    <div className="pb-20">
      <div className="border-b border-[var(--color-border)]">
        <div className="px-10 pt-10 pb-6">
          <Link
            href={`/admin/prospects/${id}`}
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-dark)] hover:text-[var(--color-ink)] transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Terug naar dossier
          </Link>

          <div className="mt-6 flex items-center gap-4">
            {p?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.logoUrl}
                alt={displayName}
                className="h-10 w-10 rounded-sm object-contain bg-[var(--color-surface-2)]"
              />
            ) : (
              <div className="h-10 w-10 rounded-sm bg-[var(--color-ink)] text-[var(--color-gold-hi)] flex items-center justify-center text-[14px] font-bold font-['Sora']">
                {initial}
              </div>
            )}
            <h1 className="font-['Sora'] text-[24px] font-semibold leading-none tracking-[-0.01em] text-[var(--color-ink)]">
              {displayName}
            </h1>
          </div>

          <nav className="mt-6 flex gap-8 text-[12px] uppercase tracking-[0.14em]">
            {TABS.map((tab) => {
              const href = `/admin/prospects/${id}/${tab.key}`;
              const isActive = tab.key === active || pathname === href;
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={cn(
                    'pb-2 border-b-2 transition-colors',
                    isActive
                      ? 'border-[var(--color-gold)] text-[var(--color-ink)] font-medium'
                      : 'border-transparent text-[var(--color-muted-dark)] hover:text-[var(--color-ink)]',
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="px-10 pt-10">{children}</div>
    </div>
  );
}

export function ComingSoonBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-gold)]">
        Volledige weergave volgt
      </span>
      <h2 className="mt-4 font-['Sora'] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)]">
        {title}
      </h2>
      <p className="mt-4 text-[15px] leading-[1.6] text-[var(--color-muted-dark)]">
        {description}
      </p>
    </div>
  );
}
