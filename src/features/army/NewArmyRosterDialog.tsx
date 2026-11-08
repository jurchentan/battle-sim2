import { useEffect, useState, type FormEvent } from 'react';
import { useRosterLibraryStore } from '../../state/rosterLibraryStore';
import { fieldClass, primaryButtonClass, secondaryButtonClass } from './ui';

export function NewArmyRosterDialog({ onClose }: { onClose: () => void }) {
  const newRoster = useRosterLibraryStore((state) => state.newRoster);
  const libraryError = useRosterLibraryStore((state) => state.error);
  const clearError = useRosterLibraryStore((state) => state.clearError);

  const [name, setName] = useState('Untitled roster');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const validationError = name.trim() ? null : 'Enter a roster name.';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (validationError || submitting) return;

    setSubmitting(true);
    try {
      await newRoster({ name: name.trim() });
      if (!useRosterLibraryStore.getState().error) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f2b23]/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-army-roster-heading"
        data-testid="new-army-roster-dialog"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[#c9bda3] bg-[#fbf7ed] shadow-2xl"
      >
        <header className="border-b border-[#e0d6c1] px-5 py-4">
          <p className="text-[0.62rem] font-semibold tracking-[0.16em] text-[#8a7a58] uppercase">
            New army roster
          </p>
          <h2
            id="new-army-roster-heading"
            className="font-display mt-1 text-2xl font-semibold text-[#2f2b23]"
          >
            Start an order of battle
          </h2>
          <p className="mt-1 text-xs text-[#7c715c]">
            A new roster starts empty. Add factions first, then build the chain of command from army
            to corps, division, and brigade.
          </p>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#5f594b]">
              Roster name
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClass}
              />
            </label>

            <section className="rounded-lg border border-[#e2d8c3] bg-[#f8f2e5] px-3 py-2.5">
              <h3 className="text-[0.62rem] font-semibold tracking-[0.14em] text-[#8a7a58] uppercase">
                Default hierarchy
              </h3>
              <p className="mt-1 text-[0.68rem] leading-4 text-[#7c715c]">
                Army → Corps → Division → Brigade. Regiment and other custom echelons remain
                available, and every unit can be reparented later.
              </p>
            </section>

            {validationError ? (
              <p role="alert" className="text-xs font-medium text-[#8b3a2f]">
                {validationError}
              </p>
            ) : null}

            {libraryError ? (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-md border border-[#d3b3a8] bg-[#f9ede8] px-3 py-2 text-xs text-[#8b3a2f]"
              >
                <span>{libraryError}</span>
                <button
                  type="button"
                  className="shrink-0 font-semibold underline"
                  onClick={clearError}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-[#e0d6c1] bg-[#f8f2e5] px-5 py-3">
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={Boolean(validationError) || submitting}
            >
              {submitting ? 'Creating…' : 'Create roster'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
