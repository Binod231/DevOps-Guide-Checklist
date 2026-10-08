import type { ReactNode } from 'react';

/** Consistent page padding and vertical rhythm for every route. */
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>;
}
