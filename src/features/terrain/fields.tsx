import { useState, type ReactNode } from 'react';

const inputClass =
  'rounded-md border border-[#cfc3a8] bg-white/70 px-2 py-1.5 text-sm text-[#2f2b23] outline-none focus:border-[#7d916f] focus:ring-2 focus:ring-[#7d916f]/25';

function useDraft<T>(value: T, format: (value: T) => string = String) {
  const [draft, setDraft] = useState(() => format(value));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(format(value));
  }

  return [draft, setDraft] as const;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-[0.62rem] font-normal text-[#8a7a58]">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useDraft(value);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <Field label={label}>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        className={inputClass}
      />
    </Field>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useDraft(value);

  const commit = (): void => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);

    if (next !== value) onCommit(next);
    setDraft(String(next));
  };

  return (
    <Field label={label}>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
        className={inputClass}
      />
    </Field>
  );
}

export function ColorField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useDraft(value);

  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <Field label={label}>
      <span className="flex items-center gap-2 rounded-md border border-[#cfc3a8] bg-white/70 px-2 py-1.5">
        <input
          type="color"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[0.68rem] text-[#6b6353]">{draft}</span>
      </span>
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) onChange(next.value);
        }}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
