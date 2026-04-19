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
  ExternalLink,
  FolderSearch,
  CodeXml,
  ChevronDown,
} from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';

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
  const [showCodebaseForm, setShowCodebaseForm] = useState(false);
  const [codebasePath, setCodebasePath] = useState('');
  const [form, setForm] = useState(emptyForm);

  const utils = api.useUtils();

  const useCases = api.useCases.list.useQuery();
  const activeProjectQuery = api.projects.listSpvsForActiveProject.useQuery();

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

  const vaultImportMutation = api.useCases.importFromVault.useMutation({
    onSuccess: async (data) => {
      await utils.useCases.list.invalidate();
      let message = `Scanned ${data.filesScanned} files. Created ${data.created} use cases, skipped ${data.skipped} duplicates.`;
      if (data.errors.length > 0) {
        message += `\n\nErrors:\n${data.errors.join('\n')}`;
      }
      window.alert(message);
    },
  });

  const codebaseImportMutation = api.useCases.importFromCodebase.useMutation({
    onSuccess: async (data) => {
      await utils.useCases.list.invalidate();
      let message = `Analyzed ${data.projectName} (${data.filesAnalyzed} files). Created ${data.created} use cases, skipped ${data.skipped} duplicates.`;
      if (data.errors.length > 0) {
        message += `\n\nErrors:\n${data.errors.join('\n')}`;
      }
      window.alert(message);
    },
  });

  const atlantisImportMutation =
    api.useCases.importFromAtlantisVolumes.useMutation({
      onSuccess: async (data) => {
        await utils.useCases.list.invalidate();
        let message = `Scanned ${data.filesScanned} files. Created ${data.created}, updated ${'updated' in data && typeof data.updated === 'number' ? data.updated : 0}, skipped ${data.skipped}.`;
        if ('scannedPath' in data && typeof data.scannedPath === 'string') {
          message += `\nPath: ${data.scannedPath}`;
        }
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
  const activeProject = activeProjectQuery.data?.project;
  const isAtlantisProject = activeProject?.projectType === 'ATLANTIS';
  const isCatalogReadOnly = isAtlantisProject;
  const showKlarifaiImportActions = !isAtlantisProject;
  const catalogLabel = isAtlantisProject ? 'RAG Documents' : 'Use Cases';
  const catalogItemLabel = isAtlantisProject ? 'RAG Document' : 'Use Case';
  const codebaseInputClass =
    'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#040026]/5 focus:border-[#040026] transition-all';

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Page header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          {catalogLabel}
          <span className="text-[var(--color-gold)]">.</span>
        </h1>
        <div className="flex items-center gap-2">
          {showKlarifaiImportActions && (
            <>
              <button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all disabled:opacity-50"
              >
                {importMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {importMutation.isPending ? 'Importing...' : 'Import Obsidian'}
              </button>
              <button
                onClick={() => vaultImportMutation.mutate()}
                disabled={vaultImportMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all disabled:opacity-50"
              >
                {vaultImportMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderSearch className="w-3.5 h-3.5" />
                )}
                {vaultImportMutation.isPending ? 'Scanning...' : 'Scan Vault'}
              </button>
            </>
          )}
          {!isCatalogReadOnly && (
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
            >
              <Plus className="w-3.5 h-3.5" />
              New {catalogItemLabel}
            </button>
          )}
          {isAtlantisProject && (
            <button
              onClick={() => atlantisImportMutation.mutate()}
              disabled={atlantisImportMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-[var(--color-ink)] text-white disabled:opacity-50"
            >
              {atlantisImportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing Atlantis...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Sync Atlantis Volumes
                </>
              )}
            </button>
          )}
        </div>
      </div>
      {showKlarifaiImportActions && (
        <div className="space-y-3">
          <button
            onClick={() => setShowCodebaseForm((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showCodebaseForm ? 'rotate-180' : ''}`}
            />
            Analyze a project codebase...
          </button>

          {showCodebaseForm && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={codebasePath}
                onChange={(e) => setCodebasePath(e.target.value)}
                placeholder="/home/klarifai/Documents/klarifai/projects/copifai"
                className={codebaseInputClass}
              />
              <button
                onClick={() =>
                  codebaseImportMutation.mutate({ projectPath: codebasePath })
                }
                disabled={
                  codebaseImportMutation.isPending ||
                  codebasePath.trim().length === 0
                }
                className="admin-btn-secondary sm:shrink-0"
              >
                {codebaseImportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <CodeXml className="w-4 h-4" />
                    Analyze Codebase
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-black text-[#040026] uppercase tracking-wider">
            New {catalogItemLabel}
          </h2>
          <UseCaseForm
            form={form}
            setForm={setForm}
            itemLabel={catalogItemLabel}
            onSave={handleSave}
            onCancel={cancelForm}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Loading state */}
      {useCases.isLoading && (
        <PageLoader
          label="Loading use cases"
          description="Preparing the use case library."
        />
      )}

      {/* Empty state */}
      {!useCases.isLoading && list.length === 0 && (
        <div className="py-20 text-center">
          <BookOpen className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
          <p className="text-[13px] font-light text-[var(--color-muted)]">
            {isAtlantisProject
              ? 'No Atlantis RAG documents yet. Sync from Atlantis volumes.'
              : 'No use cases yet. Create one, import from Obsidian, or scan vault.'}
          </p>
        </div>
      )}

      {/* Use case list */}
      {list.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
              {list.length}{' '}
              {list.length === 1
                ? catalogItemLabel.toLowerCase()
                : `${catalogLabel.toLowerCase()}`}
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          {list.map((uc) => (
            <div
              key={uc.id}
              className="py-5 border-b border-[var(--color-surface-2)]"
            >
              {editingId === uc.id ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)]">
                      Edit {catalogItemLabel}
                    </span>
                    <span className="flex-1 h-px bg-[var(--color-border)]" />
                  </div>
                  <UseCaseForm
                    form={form}
                    setForm={setForm}
                    itemLabel={catalogItemLabel}
                    onSave={handleSave}
                    onCancel={cancelForm}
                    isSaving={isSaving}
                  />
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[17px] font-medium text-[var(--color-ink)] tracking-[-0.01em]">
                          {uc.title}
                        </span>
                        <span className="text-[9px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-muted)]">
                          {uc.category}
                        </span>
                        {uc.isShipped && (
                          <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--color-brand-success)]">
                            Shipped
                          </span>
                        )}
                        {!uc.isActive && (
                          <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--color-brand-danger)]">
                            Inactive
                          </span>
                        )}
                        {uc._count.proofMatches > 0 && (
                          <span className="text-[10px] font-light text-[var(--color-muted)]">
                            {uc._count.proofMatches} matches
                          </span>
                        )}
                      </div>
                    </div>
                    {!isCatalogReadOnly && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(uc)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deactivate "${uc.title}"?`)) {
                              deleteMutation.mutate({ id: uc.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[#b45a3b] hover:text-[#b45a3b] transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-[13px] font-light text-[var(--color-muted)] mt-2 leading-[1.55] max-w-[700px]">
                    {uc.summary}
                  </p>

                  {uc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {uc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-light text-[var(--color-muted)] px-2 py-0.5 rounded bg-[var(--color-surface-2)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {uc.outcomes.length > 0 && (
                    <ul className="list-disc list-inside mt-2 pl-1">
                      {uc.outcomes.map((outcome) => (
                        <li
                          key={outcome}
                          className="text-[12px] font-light text-[var(--color-muted)]"
                        >
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  )}

                  {uc.caseStudyRefs.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      {uc.caseStudyRefs.map((ref) => (
                        <a
                          key={ref}
                          href={ref.startsWith('http') ? ref : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-medium text-[var(--color-ink)] border-b border-[var(--color-border-strong)] hover:border-[var(--color-ink)] transition-colors inline-flex items-center gap-1"
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
  itemLabel,
  onSave,
  onCancel,
  isSaving,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  itemLabel: string;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const inputClass = 'input-minimal w-full px-3 py-2.5 rounded-md text-[13px]';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
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
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
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
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
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
          <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] disabled:opacity-50"
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </span>
          ) : (
            `Save ${itemLabel}`
          )}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
