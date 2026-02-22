'use client';

import { useState } from 'react';
import { api } from '@/components/providers';
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  Tag,
  ExternalLink,
} from 'lucide-react';

type UseCase = {
  id: string;
  title: string;
  summary: string;
  category: string;
  outcomes: string[];
  tags: string[];
  caseStudyRefs: string[];
  isActive: boolean;
  isShipped: boolean;
  externalUrl: string | null;
  sourceRef: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count: {
    proofMatches: number;
  };
};

const emptyForm = {
  title: '',
  summary: '',
  category: '',
  outcomes: '',
  tags: '',
  caseStudyRefs: '',
  isShipped: true,
  externalUrl: '',
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function UseCasesPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const utils = api.useUtils();

  const useCases = api.useCases.list.useQuery();

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

  const importMutation = api.useCases.importFromObsidian.useMutation({
    onSuccess: async (data) => {
      await utils.useCases.list.invalidate();
      let message = `Created ${data.created} use cases, skipped ${data.skipped} duplicates.`;
      if (data.errors.length > 0) {
        message += `\n\nErrors:\n${data.errors.join('\n')}`;
      }
      window.alert(message);
    },
  });

  function startEdit(uc: UseCase) {
    setEditingId(uc.id);
    setShowCreateForm(false);
    setForm({
      title: uc.title,
      summary: uc.summary,
      category: uc.category,
      outcomes: uc.outcomes.join(', '),
      tags: uc.tags.join(', '),
      caseStudyRefs: uc.caseStudyRefs.join(', '),
      isShipped: uc.isShipped,
      externalUrl: uc.externalUrl ?? '',
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
      outcomes: splitCsv(form.outcomes),
      tags: splitCsv(form.tags),
      caseStudyRefs: splitCsv(form.caseStudyRefs),
      isShipped: form.isShipped,
      externalUrl: form.externalUrl,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const list = (useCases.data ?? []) as UseCase[];

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#040026]">
            Use Cases
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            {/* TERM-02: "proof matching" replaced with plain description */}
            Service catalog — evidence-backed offerings that can be matched to
            prospect needs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingId(null);
              setForm(emptyForm);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#040026] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Use Case
          </button>
          <button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import from Obsidian
              </>
            )}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-black text-[#040026] uppercase tracking-wider">
            New Use Case
          </h2>
          <UseCaseForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={cancelForm}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Loading state */}
      {useCases.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      )}

      {/* Empty state */}
      {!useCases.isLoading && list.length === 0 && (
        <div className="glass-card p-12 text-center rounded-[2.5rem]">
          <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">
            No use cases yet. Create one or import from Obsidian.
          </p>
        </div>
      )}

      {/* Use case list */}
      {list.length > 0 && (
        <div className="space-y-4">
          {list.map((uc) => (
            <div key={uc.id} className="glass-card p-6">
              {editingId === uc.id ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-[#040026] uppercase tracking-wider">
                    Edit Use Case
                  </h3>
                  <UseCaseForm
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    onCancel={cancelForm}
                    isSaving={isSaving}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Title row */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-[#040026]">
                        {uc.title}
                      </span>
                      <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700">
                        {uc.category}
                      </span>
                      {uc.isShipped && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                          Shipped
                        </span>
                      )}
                      {!uc.isActive && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-500">
                          Inactive
                        </span>
                      )}
                      {uc._count.proofMatches > 0 && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
                          {uc._count.proofMatches} matches
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(uc)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Deactivate "${uc.title}"?`)) {
                            deleteMutation.mutate({ id: uc.id });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-100 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-slate-600">{uc.summary}</p>

                  {/* Tags */}
                  {uc.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tag className="w-3 h-3 text-slate-300 shrink-0" />
                      {uc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Outcomes */}
                  {uc.outcomes.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      {uc.outcomes.map((outcome) => (
                        <li key={outcome} className="text-xs text-slate-500">
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Case study refs */}
                  {uc.caseStudyRefs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {uc.caseStudyRefs.map((ref) => (
                        <a
                          key={ref}
                          href={ref.startsWith('http') ? ref : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {ref}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#040026]/5 focus:border-[#040026] transition-all';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
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
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Category
          </label>
          <input
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
            placeholder="e.g. design, workflow, content"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Summary
        </label>
        <textarea
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          placeholder="Brief description of this use case and what problem it solves"
          rows={3}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Tags{' '}
            <span className="font-normal text-slate-400">
              (comma-separated)
            </span>
          </label>
          <input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="e.g. branding, logo, visual identity"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Outcomes{' '}
            <span className="font-normal text-slate-400">
              (comma-separated)
            </span>
          </label>
          <input
            value={form.outcomes}
            onChange={(e) =>
              setForm((f) => ({ ...f, outcomes: e.target.value }))
            }
            placeholder="e.g. Consistent brand, 30% recognition lift"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Case Study Refs{' '}
            <span className="font-normal text-slate-400">
              (comma-separated)
            </span>
          </label>
          <input
            value={form.caseStudyRefs}
            onChange={(e) =>
              setForm((f) => ({ ...f, caseStudyRefs: e.target.value }))
            }
            placeholder="e.g. https://... , internal-ref-id"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            External URL
          </label>
          <input
            value={form.externalUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, externalUrl: e.target.value }))
            }
            placeholder="https://..."
            type="url"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isShipped"
          type="checkbox"
          checked={form.isShipped}
          onChange={(e) =>
            setForm((f) => ({ ...f, isShipped: e.target.checked }))
          }
          className="rounded border-slate-200"
        />
        <label
          htmlFor="isShipped"
          className="text-sm font-medium text-slate-600"
        >
          Shipped (service is live and available)
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={
            isSaving ||
            form.title.trim().length < 2 ||
            form.summary.trim().length < 10 ||
            form.category.trim().length < 2
          }
          className="px-6 py-3 bg-[#040026] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Use Case'
          )}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
