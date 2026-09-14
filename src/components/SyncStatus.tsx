import { useEffect, useState } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw } from 'lucide-react';
import { isOnline, subscribeOnline } from '../lib/offline';

// Écrire hors ligne ne doit pas inquiéter. Plutôt qu'une roue qui tourne
// sans fin ou un message d'erreur, on dit ce qui est vrai : c'est écrit,
// ce n'est pas encore parti, ça partira tout seul.
//
// Rien ne s'affiche quand tout va bien — un badge permanent finirait par
// ne plus rien vouloir dire.
export function SyncStatus() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(isOnline);
  const pending = useIsMutating();

  useEffect(() => subscribeOnline(setOnline), []);

  // De retour en ligne, on relance ce qui attendait sans faire patienter
  // l'utilisateur derrière un bouton.
  useEffect(() => {
    if (online) void queryClient.resumePausedMutations();
  }, [online, queryClient]);

  if (online && pending === 0) return null;

  const label = !online
    ? pending > 0
      ? `Hors ligne — ${pending} modification${pending > 1 ? 's' : ''} en attente`
      : 'Hors ligne — tu peux continuer d’écrire'
    : 'Envoi…';

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 max-md:bottom-20"
    >
      <span className="flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white shadow-lg">
        {online ? (
          <RefreshCw size={13} strokeWidth={2.4} className="animate-spin" />
        ) : (
          <CloudOff size={13} strokeWidth={2.4} />
        )}
        {label}
      </span>
    </div>
  );
}
