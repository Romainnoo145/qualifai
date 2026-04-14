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
    'ui-tap flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border transition-all';

  const buttonClassFor = (key: ActionKey): string => {
    const state = states[key];
    if (state === 'loading')
      return cn(
        buttonBase,
        'bg-slate-50 text-slate-400 border-slate-200 cursor-wait',
      );
    if (state === 'success')
      return cn(
        buttonBase,
        'bg-emerald-50 text-emerald-700 border-emerald-200',
      );
    if (state === 'fallback')
      return cn(buttonBase, 'bg-amber-50 text-amber-800 border-amber-300');
    if (state === 'error')
      return cn(buttonBase, 'bg-red-50 text-red-700 border-red-300');
    return cn(
      buttonBase,
      'bg-slate-50 text-slate-600 hover:text-[#040026] hover:bg-[#EBCB4B]/20 border-slate-200',
    );
  };

  return (
    <div
      className="glass-card p-6 space-y-3"
      data-testid="prospect-actions-panel"
    >
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
        Acties
      </h3>
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
          className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
          role="status"
          data-testid="action-fallback"
        >
          {fallbackMessage}
        </div>
      )}
      {errorMessage && (
        <div
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
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
