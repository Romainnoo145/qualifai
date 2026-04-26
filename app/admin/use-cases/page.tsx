'use client';

import { useState } from 'react';
import { api } from '@/components/providers';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';
import { SECTOR_LABELS } from '@/lib/constants/sectors';
import type { UseCaseSector } from '@prisma/client';

type UseCase = {
  id: string;
  title: string;
  summary: string;
  category: string;
  sector: UseCaseSector | null;
  outcomes: string[];
  tags: string[];
  caseStudyRefs: string[];
  isActive: boolean;
  isShipped: boolean;
  externalUrl: string | null;
  sourceRef: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count: { proofMatches: number };
};

const SECTORS = Object.entries(SECTOR_LABELS) as [UseCaseSector, string][];

const emptyForm = {
  title: '',
  summary: '',
  category: '',
  sector: '' as UseCaseSector | '',
  outcomes: '',
  tags: '',
  isShipped: true,
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function UseCasesPage() {
  const [selectedSector, setSelectedSector] = useState<UseCaseSector | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const utils = api.useUtils();

  const useCases = api.useCases.list.useQuery(
    selectedSector ? { sector: selectedSector } : undefined,
  );

  const createMutation = api.useCases.create.useMutation({
    onSuccess: async () => {
      setForm(emptyForm);
      setShowCreateForm(false);
      await utils.useCases.list.invalidate();
    },
  });

  const updateMutation = api.useCases.update.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      setForm(emptyForm);
      await utils.useCases.list.invalidate();
    },
  });

  const deleteMutation = api.useCases.delete.useMutation({
    onSuccess: async () => {
      await utils.useCases.list.invalidate();
    },
  });

  function startEdit(uc: UseCase) {
    setEditingId(uc.id);
    setShowCreateForm(false);
    setForm({
      title: uc.title,
      summary: uc.summary,
      category: uc.category,
      sector: uc.sector ?? '',
      outcomes: uc.outcomes.join(', '),
      tags: uc.tags.join(', '),
      isShipped: uc.isShipped,
    });
  }

  function cancelForm() {
    setEditingId(null);
    setShowCreateForm(false);
    setForm(emptyForm);
  }

  function handleSave() {
    const payload = {
      title: form.title,
      summary: form.summary,
      category: form.category,
      sector: form.sector || undefined,
      outcomes: splitCsv(form.outcomes),
      tags: splitCsv(form.tags),
      isShipped: form.isShipped,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const list = (useCases.data ?? []) as UseCase[];

  // Group by sector for "Alle" view
  const grouped = SECTORS.reduce(
    (acc, [key, label]) => {
      const items = list.filter((uc) => uc.sector === key);
      if (items.length > 0) acc.push({ key, label, items });
      return acc;
    },
    [] as { key: UseCaseSector; label: string; items: UseCase[] }[],
  );
  const uncategorized = list.filter((uc) => !uc.sector);
  const sectorCounts = SECTORS.map(([key]) => ({
    key,
    count: list.filter((uc) => uc.sector === key).length,
  }));

  return (
    <div className="max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
            Use Cases<span className="text-[var(--color-gold-hi)]">.</span>
          </h1>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingId(null);
            setForm({ ...emptyForm, sector: selectedSector ?? '' });
          }}
          className="inline-flex items-center gap-2 px-5 py-2 text-[10px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
        >
          <Plus className="w-3.5 h-3.5" />
          Nieuwe Use Case
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="glass-card p-5 space-y-4">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
            Nieuwe Use Case
          </span>
          <UseCaseForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={cancelForm}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Loading */}
      {useCases.isLoading && (
        <PageLoader
          label="Loading use cases"
          description="Preparing the use case library."
        />
      )}

      {/* Main layout: sidebar + content */}
      {!useCases.isLoading && (
        <div className="flex gap-6">
          {/* Sector sidebar */}
          <nav className="w-[220px] shrink-0 space-y-0.5">
            <button
              onClick={() => setSelectedSector(null)}
              className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${
                selectedSector === null
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              Alle <span className="opacity-60 ml-1">{list.length}</span>
            </button>
            {SECTORS.map(([key, label]) => {
              const count = sectorCounts.find((s) => s.key === key)?.count ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSector(key)}
                  className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-medium transition-colors ${
                    selectedSector === key
                      ? 'bg-[var(--color-ink)] text-white'
                      : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  {label} <span className="opacity-60 ml-1">{count}</span>
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {list.length === 0 && (
              <p className="text-[13px] text-[var(--color-muted)] py-12 text-center">
                Geen use cases gevonden.
              </p>
            )}

            {/* Grouped view (Alle) */}
            {selectedSector === null && list.length > 0 && (
              <div className="space-y-6">
                {grouped.map(({ key, label, items }) => (
                  <SectorGroup
                    key={key}
                    label={label}
                    items={items}
                    editingId={editingId}
                    form={form}
                    setForm={setForm}
                    onEdit={startEdit}
                    onDelete={(id) => deleteMutation.mutate({ id })}
                    onSave={handleSave}
                    onCancel={cancelForm}
                    isSaving={isSaving}
                  />
                ))}
                {uncategorized.length > 0 && (
                  <SectorGroup
                    label="Overig"
                    items={uncategorized}
                    editingId={editingId}
                    form={form}
                    setForm={setForm}
                    onEdit={startEdit}
                    onDelete={(id) => deleteMutation.mutate({ id })}
                    onSave={handleSave}
                    onCancel={cancelForm}
                    isSaving={isSaving}
                  />
                )}
              </div>
            )}

            {/* Filtered view */}
            {selectedSector !== null && list.length > 0 && (
              <div className="space-y-1">
                {list.map((uc) => (
                  <UseCaseRow
                    key={uc.id}
                    uc={uc}
                    isEditing={editingId === uc.id}
                    form={form}
                    setForm={setForm}
                    onEdit={() => startEdit(uc)}
                    onDelete={() => deleteMutation.mutate({ id: uc.id })}
                    onSave={handleSave}
                    onCancel={cancelForm}
                    isSaving={isSaving}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sector Group ─── */
function SectorGroup({
  label,
  items,
  editingId,
  form,
  setForm,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  isSaving,
}: {
  label: string;
  items: UseCase[];
  editingId: string | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onEdit: (uc: UseCase) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
          {label} ({items.length})
        </span>
        <span className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      <div className="space-y-1">
        {items.map((uc) => (
          <UseCaseRow
            key={uc.id}
            uc={uc}
            isEditing={editingId === uc.id}
            form={form}
            setForm={setForm}
            onEdit={() => onEdit(uc)}
            onDelete={() => onDelete(uc.id)}
            onSave={onSave}
            onCancel={onCancel}
            isSaving={isSaving}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Use Case Row ─── */
function UseCaseRow({
  uc,
  isEditing,
  form,
  setForm,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  isSaving,
}: {
  uc: UseCase;
  isEditing: boolean;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onEdit: () => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  if (isEditing) {
    return (
      <div className="py-3 px-4 rounded-md bg-[var(--color-surface)] space-y-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
          Bewerken
        </span>
        <UseCaseForm
          form={form}
          setForm={setForm}
          onSave={onSave}
          onCancel={onCancel}
          isSaving={isSaving}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-4 py-3 px-4 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-[var(--color-ink)] truncate">
            {uc.title}
          </span>
          {uc._count.proofMatches > 0 && (
            <span className="text-[10px] text-[var(--color-muted)]">
              {uc._count.proofMatches} matches
            </span>
          )}
          {uc.outcomes.length > 0 && (
            <span className="text-[10px] text-[var(--color-muted)]">
              {uc.outcomes.length} outcomes
            </span>
          )}
        </div>
        <p className="text-[12px] text-[var(--color-muted)] line-clamp-2 mt-0.5 max-w-[600px]">
          {uc.summary}
        </p>
        {uc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {uc.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-[var(--color-muted)] px-2 py-0.5 rounded bg-[var(--color-surface)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Deactivate "${uc.title}"?`)) onDelete();
          }}
          className="p-1.5 rounded text-[var(--color-muted)] hover:text-[#b45a3b] hover:bg-[var(--color-surface)] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Form ─── */
type FormState = typeof emptyForm;

function UseCaseForm({
  form,
  setForm,
  onSave,
  onCancel,
  isSaving,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const inputClass = 'input-minimal w-full px-3 py-2 rounded-md text-[13px]';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Title
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Brand Identity Design"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Category
          </label>
          <input
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
            placeholder="e.g. design, workflow"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Sector
          </label>
          <select
            value={form.sector}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                sector: e.target.value as UseCaseSector | '',
              }))
            }
            className={inputClass}
          >
            <option value="">— Geen sector —</option>
            {SECTORS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
          Summary
        </label>
        <textarea
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          placeholder="Brief description of this use case"
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Outcomes{' '}
            <span className="font-normal opacity-60">(comma-separated)</span>
          </label>
          <input
            value={form.outcomes}
            onChange={(e) =>
              setForm((f) => ({ ...f, outcomes: e.target.value }))
            }
            placeholder="e.g. 30% cost reduction, faster delivery"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Tags{' '}
            <span className="font-normal opacity-60">(comma-separated)</span>
          </label>
          <input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="e.g. automation, reporting"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={
            isSaving ||
            form.title.trim().length < 2 ||
            form.summary.trim().length < 10 ||
            form.category.trim().length < 2
          }
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
            </>
          ) : (
            'Opslaan'
          )}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
