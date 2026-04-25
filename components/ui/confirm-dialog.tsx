'use client';

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Verwijderen',
  cancelLabel = 'Annuleer',
  onConfirm,
  onCancel,
  isPending,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(10,10,46,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[400px] mx-4 bg-white border border-[var(--color-border)] rounded-[8px] p-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-3">
          Bevestiging
        </p>
        <h2 className="font-['Sora'] text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-ink)] mb-2">
          {title}
          <span style={{ color: 'var(--color-gold)' }}>.</span>
        </h2>
        {description && (
          <p className="text-[13px] font-light leading-[1.55] text-[var(--color-muted-dark)] mb-6">
            {description}
          </p>
        )}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-full text-[10px] font-medium uppercase tracking-[0.1em] bg-[var(--color-ink)] text-white border border-[var(--color-ink)] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isPending ? 'Even geduld…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full text-[10px] font-medium uppercase tracking-[0.1em] border border-[var(--color-border)] text-[var(--color-muted-dark)] hover:border-[var(--color-ink)] transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
