import type { ReactNode } from 'react';

export function ArmyField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
      {label}
      {children}
      {hint ? <span className="text-[0.65rem] font-normal text-[#8a7a58]">{hint}</span> : null}
    </label>
  );
}
