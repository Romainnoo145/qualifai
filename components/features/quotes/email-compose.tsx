'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';

interface EmailComposeProps {
  defaultTo: string;
  defaultSubject: string;
  brochureUrl: string;
  isSubmitting: boolean;
  onSend: (data: { to: string; subject: string; body: string }) => void;
  onCancel: () => void;
}

export function EmailCompose({
  defaultTo,
  defaultSubject,
  brochureUrl,
  isSubmitting,
  onSend,
  onCancel,
}: EmailComposeProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(
    `Beste,\n\nHierbij ons voorstel voor de besproken werkzaamheden.\n\nBekijk het volledige voorstel via onderstaande link:\n${brochureUrl}\n\nMocht je vragen hebben, dan hoor ik het graag.\n\nMet vriendelijke groet,\nRomano Kanters\nKlarifai`,
  );

  return (
    <div className="rounded-xl bg-[var(--color-surface-2)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Email versturen
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="email@bedrijf.nl"
          className="input-minimal w-full text-[13px]"
        />
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="input-minimal w-full text-[13px]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="input-minimal w-full text-[13px] leading-[1.6]"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onSend({ to, subject, body })}
          disabled={isSubmitting || !to.trim()}
          className="admin-btn-primary inline-flex items-center gap-2"
        >
          <Send className="h-3.5 w-3.5" />
          {isSubmitting ? 'Versturen...' : 'Verstuur definitief'}
        </button>
      </div>
    </div>
  );
}
