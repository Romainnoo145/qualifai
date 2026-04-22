'use client';

interface Props {
  variant?: 'full' | 'inline';
  currentStep?: string | null;
}

export function RerunLoadingScreen({ variant = 'inline', currentStep }: Props) {
  const isFull = variant === 'full';

  return (
    <div
      className={
        isFull
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-navy)]'
          : 'flex items-center justify-center py-24'
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <Spinner inverted={isFull} />
        <div className="flex flex-col gap-2">
          <h2
            className={
              'font-["Sora"] text-2xl font-medium ' +
              (isFull ? 'text-white' : 'text-[var(--color-ink)]')
            }
          >
            Analyse wordt bijgewerkt
          </h2>
          <p
            className={
              'font-["Sora"] text-sm font-light ' +
              (isFull ? 'text-white/70' : 'text-[var(--color-muted)]')
            }
          >
            Dit duurt een paar minuten.
          </p>
          {currentStep ? (
            <p className="mt-3 font-['Sora'] text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-gold)]">
              {currentStep}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Spinner({ inverted }: { inverted: boolean }) {
  const ringColor = inverted ? 'rgba(255,255,255,0.15)' : 'var(--color-border)';
  const accentColor = 'var(--color-gold)';
  return (
    <div
      className="animate-klarifai-spin relative h-12 w-12"
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: ringColor }}
      />
      <span
        className="absolute inset-0 rounded-full border-2 border-transparent"
        style={{ borderTopColor: accentColor }}
      />
    </div>
  );
}
