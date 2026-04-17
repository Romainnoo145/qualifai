'use client';

import { useState } from 'react';
import { PenLine, Check, X } from 'lucide-react';

interface NarrativeSection {
  label: string;
  field: 'introductie' | 'uitdaging' | 'aanpak';
  value: string;
  placeholder: string;
}

interface NarrativePreviewProps {
  introductie: string;
  uitdaging: string;
  aanpak: string;
  isGenerated: boolean;
  isReadOnly: boolean;
  onUpdate: (
    field: 'introductie' | 'uitdaging' | 'aanpak',
    value: string,
  ) => void;
}

export function NarrativePreview({
  introductie,
  uitdaging,
  aanpak,
  isGenerated,
  isReadOnly,
  onUpdate,
}: NarrativePreviewProps) {
  const sections: NarrativeSection[] = [
    {
      label: 'Introductie',
      field: 'introductie',
      value: introductie,
      placeholder:
        'Waarom we dit voorstel schrijven — wordt gegenereerd vanuit je gespreksnotities.',
    },
    {
      label: 'De uitdaging',
      field: 'uitdaging',
      value: uitdaging,
      placeholder:
        'Wat er stuk is of beter kan — wordt verrijkt met onderzoeksdata.',
    },
    {
      label: 'Onze aanpak',
      field: 'aanpak',
      value: aanpak,
      placeholder: 'Hoe Klarifai dit oplost — concreet en gefaseerd.',
    },
  ];

  if (!isGenerated && !introductie && !uitdaging && !aanpak) {
    return (
      <div className="py-12 text-center">
        <p className="text-[15px] text-[var(--color-muted)]">
          Nog niet gegenereerd. Voeg je gespreksnotities toe en klik op
          &quot;Genereer voorstel&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <NarrativeSectionBlock
          key={section.field}
          {...section}
          isReadOnly={isReadOnly}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function NarrativeSectionBlock({
  label,
  field,
  value,
  placeholder,
  isReadOnly,
  onUpdate,
}: NarrativeSection & {
  isReadOnly: boolean;
  onUpdate: (
    field: 'introductie' | 'uitdaging' | 'aanpak',
    value: string,
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing && !isReadOnly) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {label}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                onUpdate(field, draft);
                setEditing(false);
              }}
              className="admin-btn-sm admin-btn-primary"
            >
              <Check className="h-3 w-3" /> Opslaan
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              className="admin-btn-sm admin-btn-secondary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className="input-minimal w-full text-[15px] leading-[1.6]"
        />
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        {!isReadOnly && value && (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <PenLine className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {value ? (
        <div className="text-[15px] leading-[1.6] text-[var(--color-ink)] whitespace-pre-wrap">
          {value}
        </div>
      ) : (
        <p className="text-[14px] text-[var(--color-muted)] italic">
          {placeholder}
        </p>
      )}
    </div>
  );
}
