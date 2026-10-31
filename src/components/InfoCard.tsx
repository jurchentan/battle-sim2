import type { ReactNode } from 'react';

interface InfoCardProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
}

export function InfoCard({ title, eyebrow, subtitle, children }: InfoCardProps) {
  return (
    <article className="rounded-xl border border-[#d3c7ad] bg-[#fbf7ed]/90 p-6 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_8px_24px_rgba(60,48,28,0.06)]">
      <header>
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="font-display mt-1 text-xl font-semibold text-[#2f2b23]">{title}</h3>
        {subtitle ? <p className="mt-2 text-sm text-[#6b6353]">{subtitle}</p> : null}
      </header>
      <div className="mt-5">{children}</div>
    </article>
  );
}
