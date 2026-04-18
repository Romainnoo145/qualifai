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

// TERM-02: OutreachType enum values mapped to plain-language labels
const OUTREACH_TYPE_LABELS: Record<string, string> = {
  INTRO_EMAIL: 'Intro Email',
  WIZARD_LINK: 'Dashboard Link',
  PDF_REPORT: 'PDF Report',
  FOLLOW_UP: 'Follow-up',
  SIGNAL_TRIGGERED: 'Signal-triggered',
};

const outreachColors: Record<string, string> = {
  NONE: 'admin-state-neutral',
  QUEUED: 'admin-state-warning',
  EMAIL_SENT: 'admin-state-info',
  OPENED: 'admin-state-info',
  REPLIED: 'admin-state-accent',
  CONVERTED: 'admin-state-success',
  OPTED_OUT: 'admin-state-danger',
};

// TERM-02: outreachStatus enum values mapped to plain-language labels
const OUTREACH_STATUS_LABELS: Record<string, string> = {
  NONE: 'No Outreach',
  QUEUED: 'Queued',
  EMAIL_SENT: 'Email Sent',
  OPENED: 'Opened',
  REPLIED: 'Replied',
  CONVERTED: 'Converted',
  OPTED_OUT: 'Opted Out',
};

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
      <div className="glass-card p-12 text-center">
        <p className="text-[var(--color-muted)]">Contact not found</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = contact.data as any;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/contacts"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="px-4 py-1.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-border)]">
            <span className="admin-eyebrow">Contact Profile</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-ink)] transition-all">
              <span className="text-2xl font-bold text-[var(--color-ink)]">
                {c.firstName?.[0]}
                {c.lastName?.[0]}
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <h1 className="font-['Sora'] text-[32px] font-bold tracking-[-0.025em] text-[var(--color-ink)]">
                  {c.firstName} {c.lastName}
                </h1>
                <span
                  className={cn(
                    'admin-state-pill',
                    outreachColors[c.outreachStatus] ?? 'admin-state-neutral',
                  )}
                >
                  {/* TERM-02: outreachStatus displayed as plain label */}
                  {OUTREACH_STATUS_LABELS[c.outreachStatus] ?? c.outreachStatus}
                </span>
              </div>
              {c.jobTitle && (
                <p className="text-xl font-bold text-[var(--color-muted)] tracking-tight">
                  {c.jobTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={`/admin/prospects/${c.prospect?.id}`}
              className="admin-btn-primary px-8 py-3 text-xs"
            >
              View Prospect
            </a>
            {/* Queue Call / Queue LinkedIn buttons removed in 46-02 — cadence handles follow-ups */}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-[var(--color-ink)] mb-4">
              Contact Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {c.seniority && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4 text-[var(--color-muted)]" />
                  <span className="text-[var(--color-muted-dark)]">
                    {c.seniority}
                  </span>
                </div>
              )}
              {c.department && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-[var(--color-muted)]" />
                  <span className="text-[var(--color-muted-dark)]">
                    {c.department}
                  </span>
                </div>
              )}
              {c.primaryEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-[var(--color-muted)]" />
                  <a
                    href={`mailto:${c.primaryEmail}`}
                    className="text-[var(--color-brand-blue)] hover:underline"
                  >
                    {c.primaryEmail}
                  </a>
                </div>
              )}
              {c.primaryPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-[var(--color-muted)]" />
                  <span className="text-[var(--color-muted-dark)]">
                    {c.primaryPhone}
                  </span>
                </div>
              )}
              {(c.city || c.country) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-[var(--color-muted)]" />
                  <span className="text-[var(--color-muted-dark)]">
                    {[c.city, c.state, c.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {c.linkedinUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <Linkedin className="w-4 h-4 text-[var(--color-muted)]" />
                  <a
                    href={c.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-brand-blue)] hover:underline"
                  >
                    LinkedIn Profile
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Company info */}
          {c.prospect && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-[var(--color-ink)] mb-3">
                Company
              </h2>
              <Link
                href={`/admin/prospects/${c.prospect.id}`}
                className="flex items-center gap-3 p-3 bg-[var(--color-surface-2)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                {c.prospect.logoUrl ? (
                  <img
                    src={c.prospect.logoUrl}
                    alt=""
                    className="w-8 h-8 rounded-[var(--radius-sm)] object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-border-strong)] flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[var(--color-muted)]" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {c.prospect.companyName ?? c.prospect.domain}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {c.prospect.domain}
                  </p>
                </div>
              </Link>
            </div>
          )}

          {/* Outreach Log */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-[var(--color-ink)] mb-4">
              Outreach History
            </h2>
            {c.outreachLogs?.length > 0 ? (
              <div className="space-y-3">
                {c.outreachLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-[var(--color-border)] last:border-0"
                  >
                    <div>
                      <span className="text-sm font-medium text-[var(--color-muted-dark)]">
                        {/* TERM-02: OutreachType displayed as plain label */}
                        {OUTREACH_TYPE_LABELS[log.type] ?? log.type}
                      </span>
                      {log.subject && (
                        <span className="text-xs text-[var(--color-muted)] ml-2">
                          {log.subject}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--color-muted-dark)]">
                        {log.status}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)] text-center py-4">
                No outreach yet
              </p>
            )}
          </div>
        </div>

        {/* Signals sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-[var(--color-ink)] mb-4">
              Signals
            </h2>
            {c.signals?.length > 0 ? (
              <div className="space-y-3">
                {c.signals.map((signal: any) => (
                  <div
                    key={signal.id}
                    className="p-3 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3 text-[var(--color-gold)]" />
                      <span className="text-xs font-medium text-[var(--color-muted-dark)]">
                        {/* TERM-02: signalType formatted as plain label */}
                        {signal.signalType
                          .replace(/_/g, ' ')
                          .replace(
                            /\w\S*/g,
                            (w: string) =>
                              w.charAt(0).toUpperCase() +
                              w.slice(1).toLowerCase(),
                          )}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-muted-dark)]">
                      {signal.title}
                    </p>
                    {signal.description && (
                      <p className="text-xs text-[var(--color-muted)] mt-1">
                        {signal.description}
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--color-muted)] mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(signal.detectedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)] text-center py-4">
                No signals detected
              </p>
            )}
          </div>

          {/* Notes */}
          {c.outreachNotes && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-[var(--color-ink)] mb-2">
                Notes
              </h2>
              <p className="text-sm text-[var(--color-muted-dark)]">
                {c.outreachNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
