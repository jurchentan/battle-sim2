import type { ArmyRoster, UnitDefinition } from '../../models';
import { ECHELON_LABELS, unitDisplayName } from './rosterDocuments';

export const fieldClass =
  'w-full rounded-md border border-[#cfc3a8] bg-white px-2.5 py-1.5 text-sm text-[#2f2b23] outline-none focus:border-[#7d916f] focus:ring-2 focus:ring-[#7d916f]/25 disabled:bg-[#f1e9d8] disabled:text-[#857a64]';

export const secondaryButtonClass =
  'rounded border border-[#d8cdb5] bg-white/60 px-2 py-1 text-[0.65rem] font-semibold text-[#5f594b] transition-colors hover:border-[#b8a98a] hover:bg-[#efe5d2] disabled:cursor-not-allowed disabled:opacity-40';

export const primaryButtonClass =
  'rounded-md border border-[#7d916f] bg-[#eef1e4] px-2.5 py-1.5 text-xs font-semibold text-[#3d5236] transition-colors hover:border-[#5f7352] hover:bg-[#e2e8d7] disabled:cursor-not-allowed disabled:opacity-40';

export const dangerButtonClass =
  'rounded border border-[#d3b3a8] bg-[#f9ede8] px-2 py-1 text-[0.65rem] font-semibold text-[#8b3a2f] transition-colors hover:border-[#b98a7b] hover:bg-[#f3ddd4] disabled:cursor-not-allowed disabled:opacity-40';

export const sectionHeadingClass =
  'text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase';

export function unitOptionLabel(roster: ArmyRoster, unit: UnitDefinition): string {
  return `${ECHELON_LABELS[unit.echelon]} · ${unitDisplayName(roster, unit)}`;
}
