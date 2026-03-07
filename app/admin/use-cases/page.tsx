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
  FolderSearch,
  CodeXml,
  ChevronDown,
  Info,
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
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-[#040026]">
              {catalogLabel}
            </h1>
            {isCatalogReadOnly && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-[#040026] transition-colors"
                title="Atlantis catalog is read-only and synced from RAG volumes."
                aria-label="Catalog info"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:self-start">
          {!isCatalogReadOnly && (
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="admin-btn-primary"
            >
              <Plus className="w-4 h-4" />
              New {catalogItemLabel}
            </button>
          )}
          {showKlarifaiImportActions && (
            <>
              <button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                className="admin-btn-secondary"
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
              <button
                onClick={() => vaultImportMutation.mutate()}
                disabled={vaultImportMutation.isPending}
                className="admin-btn-secondary"
              >
                {vaultImportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <FolderSearch className="w-4 h-4" />
                    Scan Vault
                  </>
                )}
              </button>
            </>
          )}
          {isAtlantisProject && (
            <button
              onClick={() => atlantisImportMutation.mutate()}
              disabled={atlantisImportMutation.isPending}
              className="admin-btn-primary"
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
        <div className="glass-card p-4 sm:p-5 space-y-3">
          <button
            onClick={() => setShowCodebaseForm((prev) => !prev)}
            className="admin-btn-secondary"
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      )}

      {/* Empty state */}
      {!useCases.isLoading && list.length === 0 && (
        <div className="glass-card p-12 text-center rounded-[2.5rem]">
          <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">
            {isAtlantisProject
              ? 'No Atlantis RAG documents yet. Sync from Atlantis volumes.'
              : 'No use cases yet. Create one, import from Obsidian, or scan vault.'}
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
                    Edit {catalogItemLabel}
                  </h3>
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
                    {!isCatalogReadOnly && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(uc)}
                          className="admin-btn-secondary admin-btn-sm"
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
                          className="admin-btn-danger admin-btn-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
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
          className="admin-btn-primary"
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            `Save ${itemLabel}`
          )}
        </button>
        <button
          onClick={onCancel}
          className="admin-btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
