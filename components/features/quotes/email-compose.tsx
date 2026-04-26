'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmail: string | null;
}

interface EmailComposeProps {
  defaultSubject: string;
  brochureUrl: string;
  contacts: Contact[];
  isSubmitting: boolean;
  onSend: (data: { to: string; subject: string; body: string }) => void;
  onCancel: () => void;
}

export function EmailCompose({
  defaultSubject,
  brochureUrl,
  contacts,
  isSubmitting,
  onSend,
  onCancel,
}: EmailComposeProps) {
  const validContacts = contacts.filter(
    (c) => c.primaryEmail && c.primaryEmail.trim(),
  );

  const [selectedContactId, setSelectedContactId] = useState(
    validContacts[0]?.id ?? '',
  );
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(
    `Beste,\n\nHierbij ons voorstel voor de besproken werkzaamheden.\n\nBekijk het volledige voorstel via onderstaande link:\n${brochureUrl}\n\nMocht je vragen hebben, dan hoor ik het graag.\n\nMet vriendelijke groet,\nRomano Kanters\nKlarifai`,
  );

  const selectedContact = validContacts.find((c) => c.id === selectedContactId);
  const to = selectedContact?.primaryEmail ?? '';

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
        {validContacts.length > 0 ? (
          <select
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            className="input-minimal w-full text-[13px]"
          >
            {validContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.firstName, c.lastName].filter(Boolean).join(' ') ||
                  'Contact'}{' '}
                — {c.primaryEmail}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-[12px] text-[var(--color-muted)] p-3 border border-[var(--color-border)] rounded">
            Geen contacts met email. Voeg eerst een contact toe op de prospect
            pagina.
          </div>
        )}
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
          disabled={isSubmitting || !to}
          className="inline-flex items-center gap-2 rounded-full border border-[#e4c33c] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink)] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {isSubmitting ? 'Versturen...' : 'Verstuur definitief'}
        </button>
      </div>
    </div>
  );
}
