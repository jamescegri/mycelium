import { del, get, set } from 'idb-keyval';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  onlineManager,
} from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { createElement, updateElement } from './elements';
import { syncMentionRelations } from './relations';
import { extractMentionIds } from './content';
import { reportError } from './errors';

// Écrire ne devrait jamais dépendre du réseau. Une idée arrive dans le
// métro, en avion, dans une cave — l'app doit l'accepter et s'arranger
// ensuite.
//
// Deux mécanismes, tous deux fournis par React Query :
//   - le cache des lectures est recopié dans IndexedDB, donc l'app rouvre
//     sur ses données même sans connexion ;
//   - les écritures faites hors ligne sont mises en attente, survivent au
//     rechargement, et repartent d'elles-mêmes au retour du réseau.

const CACHE_KEY = 'mycelium-cache';

// IndexedDB plutôt que localStorage : un univers de plusieurs centaines
// d'Elements avec leur texte dépasse vite les 5 Mo de localStorage, et son
// écriture synchrone bloquerait la frappe.
const persister: Persister = {
  persistClient: (client) => set(CACHE_KEY, client),
  restoreClient: () => get<PersistedClient>(CACHE_KEY),
  removeClient: () => del(CACHE_KEY),
};

// Les clés donnent un nom aux écritures : c'est ce qui permet de les
// retrouver et de les rejouer après un rechargement, quand le composant
// qui les avait lancées n'existe plus.
export const MUTATION = {
  createElement: ['element', 'create'] as const,
  saveElement: ['element', 'save'] as const,
};

export interface CreateElementInput {
  name: string;
  content?: object | string | null;
  timeline?: boolean;
}

export interface SaveElementInput {
  id: string;
  name: string;
  content: object | string;
}

export function createQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: reportError }),
    mutationCache: new MutationCache({ onError: reportError }),
    defaultOptions: {
      queries: {
        // Le cache doit survivre à la fermeture de l'app : sans une durée
        // de vie longue, React Query jetterait les données au démarrage
        // avant même qu'on ait pu les afficher hors ligne.
        gcTime: 1000 * 60 * 60 * 24 * 14,
        // Servir d'abord ce qu'on a, rafraîchir ensuite : hors ligne, une
        // requête qui échoue ne doit pas effacer ce qui est à l'écran.
        networkMode: 'offlineFirst',
        retry: (failureCount, error) => {
          const code = (error as { code?: unknown } | null)?.code;
          if (typeof code === 'string' && code) return false;
          return failureCount < 1;
        },
      },
      mutations: {
        // Hors ligne, l'écriture est mise en pause au lieu d'échouer.
        networkMode: 'offlineFirst',
        retry: 2,
      },
    },
  });

  // Ces définitions vivent sur le client, pas dans un composant : une note
  // écrite hors ligne puis l'app fermée doit repartir au prochain
  // démarrage, même si l'on n'a jamais rouvert l'écran qui l'a créée.
  queryClient.setMutationDefaults(MUTATION.createElement, {
    mutationFn: (input: CreateElementInput) => createElement(input),
  });

  queryClient.setMutationDefaults(MUTATION.saveElement, {
    mutationFn: async ({ id, name, content }: SaveElementInput) => {
      const saved = await updateElement(id, { name, content });
      await syncMentionRelations(id, extractMentionIds(content));
      return saved;
    },
  });

  return queryClient;
}

export { persister };

// Se déconnecter doit effacer ce qui a été gardé sur l'appareil : le cache
// contient le texte des Elements en clair, et un téléphone se prête.
export async function clearOfflineCache(): Promise<void> {
  await del(CACHE_KEY);
}

// Ce que l'interface a besoin de savoir : sommes-nous connectés, et
// reste-t-il des écritures en attente ?
export function subscribeOnline(fn: (online: boolean) => void): () => void {
  return onlineManager.subscribe(fn);
}

export function isOnline(): boolean {
  return onlineManager.isOnline();
}
