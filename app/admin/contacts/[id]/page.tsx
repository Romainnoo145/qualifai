'use client';

import { api } from '@/components/providers';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  Linkedin,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/ui/page-loader';

const OUTREACH_TYPE_LABELS: Record<string, string> = {
  INTRO_EMAIL: 'Intro Email',
  WIZARD_LINK: 'Dashboard Link',
  PDF_REPORT: 'PDF Report',
  FOLLOW_UP: 'Follow-up',
  SIGNAL_TRIGGERED: 'Signal-triggered',
};

const OUTREACH_STATUS_LABELS: Record<string, string> = {
  NONE: 'No Outreach',
  QUEUED: 'Queued',
  EMAIL_SENT: 'Email Sent',
  OPENED: 'Opened',
  REPLIED: 'Replied',
  CONVERTED: 'Converted',
  OPTED_OUT: 'Opted Out',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

export default function ContactDetail() {
  const params = useParams();
  const id = params.id as string;
  const contact = api.contacts.get.useQuery({ id });

  if (contact.isLoading) {
    return (
      <PageLoader
        label="Loading contact"
        description="Preparing contact details."
      />
    );
  }

  if (!contact.data) {
    return (
      <div className="py-20 text-center">
        <p className="text-[13px] font-light text-[var(--color-muted)]">
          Contact not found
        </p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = contact.data as any;

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Back line */}
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
        <Link
          href="/admin/contacts"
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Contacts
        </Link>
        <span className="text-[10px] text-[var(--color-border-strong)]">/</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink)]">
          {c.firstName} {c.lastName}
        </span>
      </div>

      {/* Hero */}
      <header className="flex items-start justify-between pb-8 border-b border-[var(--color-ink)]">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[var(--color-ink)] flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-[var(--color-gold)]">
              {c.firstName?.[0]}
              {c.lastName?.[0]}
            </span>
          </div>
          <div>
            <h1 className="text-[clamp(28px,4vw,42px)] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
              {c.firstName} {c.lastName}
              <span className="text-[var(--color-gold)]">.</span>
            </h1>
            {c.jobTitle && (
              <p className="text-[16px] font-light text-[var(--color-muted)] mt-1">
                {c.jobTitle}
              </p>
            )}
            <span
              className={cn(
                'inline-block mt-2 text-[10px] font-medium uppercase tracking-[0.06em]',
                c.outreachStatus === 'NONE' && 'text-[var(--color-muted)]',
                c.outreachStatus === 'CONVERTED' &&
                  'text-[var(--color-brand-success)]',
                c.outreachStatus === 'OPTED_OUT' &&
                  'text-[var(--color-brand-danger)]',
                !['NONE', 'CONVERTED', 'OPTED_OUT'].includes(
                  c.outreachStatus,
                ) && 'text-[var(--color-ink)]',
              )}
            >
              {OUTREACH_STATUS_LABELS[c.outreachStatus] ?? c.outreachStatus}
            </span>
          </div>
        </div>
        {c.prospect && (
          <Link
            href={`/admin/prospects/${c.prospect.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-ink)] transition-all"
          >
            Bekijk prospect
          </Link>
        )}
      </header>

      {/* 2-column: info + signals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
        <div className="space-y-10">
          {/* Contact Info */}
          <section>
            <SectionLabel>Gegevens</SectionLabel>
            <div className="space-y-0">
              {[
                {
                  icon: Briefcase,
                  label: c.seniority,
                  show: !!c.seniority,
                },
                {
                  icon: Building2,
                  label: c.department,
                  show: !!c.department,
                },
                {
                  icon: Mail,
                  label: c.primaryEmail,
                  href: c.primaryEmail ? `mailto:${c.primaryEmail}` : undefined,
                  show: !!c.primaryEmail,
                },
                {
                  icon: Phone,
                  label: c.primaryPhone,
                  show: !!c.primaryPhone,
                },
                {
                  icon: MapPin,
                  label: [c.city, c.state, c.country]
                    .filter(Boolean)
                    .join(', '),
                  show: !!(c.city || c.country),
                },
                {
                  icon: Linkedin,
                  label: 'LinkedIn',
                  href: c.linkedinUrl,
                  show: !!c.linkedinUrl,
                },
              ]
                .filter((r) => r.show)
                .map((row) => {
                  const Icon = row.icon;
                  return (
                    <div
                      key={row.label}
                      className="flex items-center gap-3 py-3 border-b border-[var(--color-surface-2)]"
                    >
                      <Icon className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                      {row.href ? (
                        <a
                          href={row.href}
                          target={
                            row.href.startsWith('mailto') ? undefined : '_blank'
                          }
                          rel="noopener noreferrer"
                          className="text-[13px] font-medium text-[var(--color-ink)] border-b border-[var(--color-border-strong)] hover:border-[var(--color-ink)] transition-colors"
                        >
                          {row.label}
                        </a>
                      ) : (
                        <span className="text-[13px] font-medium text-[var(--color-ink)]">
                          {row.label}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Company */}
          {c.prospect && (
            <section>
              <SectionLabel>Bedrijf</SectionLabel>
              <Link
                href={`/admin/prospects/${c.prospect.id}`}
                className="flex items-center gap-4 py-4 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
              >
                <div className="w-10 h-10 rounded-[8px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                  {c.prospect.logoUrl ? (
                    <img
                      src={c.prospect.logoUrl}
                      alt=""
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-[var(--color-border-strong)]" />
                  )}
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[var(--color-ink)]">
                    {c.prospect.companyName ?? c.prospect.domain}
                  </span>
                  <p className="text-[11px] font-light text-[var(--color-muted)]">
                    {c.prospect.domain}
                  </p>
                </div>
                <span className="ml-auto w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-gold)] group-hover:border-[var(--color-ink)] transition-all shrink-0 text-[12px]">
                  →
                </span>
              </Link>
            </section>
          )}

          {/* Outreach History */}
          <section>
            <SectionLabel>Outreach History</SectionLabel>
            {c.outreachLogs?.length > 0 ? (
              <div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {c.outreachLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-3 border-b border-[var(--color-surface-2)]"
                  >
                    <div>
                      <span className="text-[13px] font-medium text-[var(--color-ink)]">
                        {OUTREACH_TYPE_LABELS[log.type] ?? log.type}
                      </span>
                      {log.subject && (
                        <span className="text-[12px] font-light text-[var(--color-muted)] ml-2">
                          {log.subject}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-[var(--color-muted)] tabular-nums">
                      {new Date(log.createdAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] font-light text-[var(--color-muted)]">
                Geen outreach history.
              </p>
            )}
          </section>
        </div>

        {/* Signals sidebar */}
        <aside className="space-y-10">
          <section>
            <SectionLabel>Signals</SectionLabel>
            {c.signals?.length > 0 ? (
              <div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {c.signals.map((signal: any) => (
                  <div
                    key={signal.id}
                    className="py-4 border-b border-[var(--color-surface-2)]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3 text-[var(--color-gold)]" />
                      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
                        {signal.signalType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-[var(--color-ink)]">
                      {signal.title}
                    </p>
                    {signal.description && (
                      <p className="text-[12px] font-light text-[var(--color-muted)] mt-1">
                        {signal.description}
                      </p>
                    )}
                    <p className="text-[10px] font-light text-[var(--color-muted)] mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(signal.detectedAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] font-light text-[var(--color-muted)]">
                Geen signals.
              </p>
            )}
          </section>

          {c.outreachNotes && (
            <section>
              <SectionLabel>Notities</SectionLabel>
              <p className="text-[13px] font-light text-[var(--color-muted-dark)] leading-relaxed">
                {c.outreachNotes}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
