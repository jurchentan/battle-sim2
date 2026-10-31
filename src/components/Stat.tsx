import type { ReactNode } from 'react';

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</dl>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e0d6c1] bg-[#f7f1e3] px-3 py-2">
      <dt className="text-[0.68rem] font-semibold tracking-[0.12em] text-[#857a64] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[#3b352a]">{value}</dd>
    </div>
  );
}
