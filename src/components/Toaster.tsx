import { useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { dismissError, getErrors, subscribeErrors } from '../lib/errors';

// Les erreurs s'affichent en bas à droite, au-dessus de tout. Elles ne
// disparaissent pas toutes seules : une écriture perdue mérite qu'on la
// lise, pas qu'elle s'efface pendant qu'on regarde ailleurs.
export function Toaster() {
  const errors = useSyncExternalStore(subscribeErrors, getErrors);
  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2.5">
      {errors.map((e) => (
        <div
          key={e.id}
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.22)]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{e.message}</p>
            {e.hint && (
              <p className="mt-1.5 text-[14px] leading-snug text-ink-2">
                {e.hint}
              </p>
            )}
          </div>
          <button
            onClick={() => dismissError(e.id)}
            aria-label="Fermer"
            className="shrink-0 text-ink-4 transition hover:text-ink"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
