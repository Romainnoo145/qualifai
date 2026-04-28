import { useEffect, useState } from 'react';

/**
 * Returns `true` only if `isLoading` has been true for at least `delayMs`.
 *
 * Avoids skeleton-flash on sub-threshold loads: page renders content directly
 * for fast resolves, skeleton appears only when the load is genuinely slow.
 *
 * Default 200ms — under that, eye perceives it as instant. Skeleton flashing
 * for 50ms looks worse than no skeleton at all.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delayMs: number = 200,
): boolean {
  const [delayedLoading, setDelayedLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- delay-guard hook needs to reset on isLoading→false; standard React pattern for this kind of synchronization (see: react-use, ahooks)
      setDelayedLoading(false);
      return;
    }
    const timer = setTimeout(() => setDelayedLoading(true), delayMs);
    return () => clearTimeout(timer);
  }, [isLoading, delayMs]);

  return delayedLoading;
}
