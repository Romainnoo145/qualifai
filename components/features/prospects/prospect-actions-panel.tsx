'use client';

import { useState } from 'react';
import {
  Loader2,
  Check,
  Database,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/components/providers';
import {
  mapMutationError,
  FRIENDLY_ERROR_GEMINI_FALLBACK,
} from './error-mapping';
import { cn } from '@/lib/utils';

interface ProspectActionsPanelProps {
  prospectId: string;
  onRunComplete?: () => void;
}

type ActionKey = 'enrich' | 'research' | 'analyse';
type ActionState = 'idle' | 'loading' | 'success' | 'fallback' | 'error';

// Verbatim Dutch button labels — do NOT change without updating REQUIREMENTS.md
const LABELS: Record<ActionKey, string> = {
  enrich: 'Verrijk opnieuw',
  research: 'Run research',
  analyse: 'Run analyse',
};

const ICONS: Record<ActionKey, React.ComponentType<{ className?: string }>> = {
  enrich: RefreshCw,
  research: Database,
  analyse: Sparkles,
};

export function ProspectActionsPanel({
  prospectId,
  onRunComplete,
}: ProspectActionsPanelProps): React.ReactElement {
  const utils = api.useUtils();
  const [states, setStates] = useState<Record<ActionKey, ActionState>>({
    enrich: 'idle',
    research: 'idle',
    analyse: 'idle',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [lastErrorKey, setLastErrorKey] = useState<ActionKey | null>(null);

  const markSuccess = (key: ActionKey, data: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackUsed = (data as any)?.fallbackUsed === true;

    setStates((s) => ({ ...s, [key]: fallbackUsed ? 'fallback' : 'success' }));
    setErrorMessage(null);
    setLastErrorKey(null);

    if (fallbackUsed) {
      setFallbackMessage(FRIENDLY_ERROR_GEMINI_FALLBACK);
    } else {
      setFallbackMessage(null);
    }

    onRunComplete?.();
    // best-effort cache invalidation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (utils.admin.getProspect as any)?.invalidate?.({ id: prospectId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (utils.research.listRuns as any)?.invalidate?.({ prospectId });

    // Fallback warning lasts ~3s, plain success lasts 2s
    const resetDelay = fallbackUsed ? 3000 : 2000;
    setTimeout(() => {
      setStates((s) => ({ ...s, [key]: 'idle' }));
      setFallbackMessage(null);
    }, resetDelay);
  };

  const markError = (key: ActionKey, err: unknown) => {
    setStates((s) => ({ ...s, [key]: 'error' }));
    setErrorMessage(mapMutationError(err));
    setFallbackMessage(null);
    setLastErrorKey(key);
  };

  const markLoading = (key: ActionKey) => {
    setStates((s) => ({ ...s, [key]: 'loading' }));
    setErrorMessage(null);
    setFallbackMessage(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichMutation = (api.admin.enrichProspect as any).useMutation({
    onMutate: () => markLoading('enrich'),
    onSuccess: (data: unknown) => markSuccess('enrich', data),
    onError: (err: unknown) => markError('enrich', err),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const researchMutation = (api.admin.runResearchRun as any).useMutation({
    onMutate: () => markLoading('research'),
    onSuccess: (data: unknown) => markSuccess('research', data),
    onError: (err: unknown) => markError('research', err),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyseMutation = (api.admin.runMasterAnalysis as any).useMutation({
    onMutate: () => markLoading('analyse'),
    onSuccess: (data: unknown) => markSuccess('analyse', data),
    onError: (err: unknown) => markError('analyse', err),
  });

  const handleClick = (key: ActionKey) => {
    if (key === 'enrich')
      enrichMutation.mutate({ id: prospectId, force: true });
    if (key === 'research') researchMutation.mutate({ id: prospectId });
    if (key === 'analyse') analyseMutation.mutate({ id: prospectId });
  };

  const buttonBase =
    'flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-sm)] text-[10px] font-medium uppercase tracking-wide border transition-all';

  const buttonClassFor = (key: ActionKey): string => {
    const state = states[key];
    if (state === 'loading')
      return cn(
        buttonBase,
        'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-border)] cursor-wait',
      );
    if (state === 'success')
      return cn(
        buttonBase,
        'bg-[var(--color-tag-enrich-bg)] text-[var(--color-tag-enrich-text)] border-[var(--color-tag-enrich-border)]',
      );
    if (state === 'fallback')
      return cn(
        buttonBase,
        'bg-[var(--color-tag-quality-bg)] text-[var(--color-tag-quality-text)] border-[var(--color-tag-quality-border)]',
      );
    if (state === 'error')
      return cn(
        buttonBase,
        'bg-[#fef2f2] text-[var(--color-brand-danger)] border-[#e0b8a8]',
      );
    return cn(
      buttonBase,
      'bg-[var(--color-surface-2)] text-[var(--color-muted-dark)] hover:text-[var(--color-ink)] hover:border-[var(--color-border-strong)] border-[var(--color-border)]',
    );
  };

  return (
    <div
      className="glass-card p-6 space-y-3"
      data-testid="prospect-actions-panel"
    >
      <h3 className="admin-eyebrow">Acties</h3>
      <div className="flex flex-wrap gap-3">
        {(['enrich', 'research', 'analyse'] as const).map((key) => {
          const state = states[key];
          const Icon = ICONS[key];
          return (
            <button
              key={key}
              onClick={() => handleClick(key)}
              disabled={state === 'loading'}
              className={buttonClassFor(key)}
              data-testid={`action-${key}`}
              data-state={state}
            >
              {state === 'loading' && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {state === 'success' && <Check className="w-3.5 h-3.5" />}
              {state === 'fallback' && (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {state !== 'loading' &&
                state !== 'success' &&
                state !== 'fallback' && <Icon className="w-3.5 h-3.5" />}
              {LABELS[key]}
            </button>
          );
        })}
      </div>
      {fallbackMessage && (
        <div
          className="text-sm text-[var(--color-tag-quality-text)] bg-[var(--color-tag-quality-bg)] border border-[var(--color-tag-quality-border)] rounded-[var(--radius-md)] px-4 py-3"
          role="status"
          data-testid="action-fallback"
        >
          {fallbackMessage}
        </div>
      )}
      {errorMessage && (
        <div
          className="text-sm text-[var(--color-brand-danger)] bg-[#fef2f2] border border-[#e0b8a8] rounded-[var(--radius-md)] px-4 py-3"
          role="alert"
          data-testid="action-error"
          data-error-key={lastErrorKey ?? ''}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
