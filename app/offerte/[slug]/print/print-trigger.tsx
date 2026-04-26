'use client';

import { useEffect } from 'react';

/**
 * Fires window.print() after a brief delay to let fonts render.
 * Mounted inside the server-rendered print page.
 */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return null;
}
