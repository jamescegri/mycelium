// Un magasin d'erreurs minimal, hors React : les échecs viennent des caches
// React Query (configurés dans main.tsx), qui ne sont pas montés dans
// l'arbre de composants. Un pub/sub de quinze lignes suffit — inutile d'un
// contexte pour ça.
export interface AppError {
  id: number;
  message: string;
  hint?: string;
}

let nextId = 1;
let errors: AppError[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeErrors(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getErrors(): AppError[] {
  return errors;
}

export function dismissError(id: number) {
  errors = errors.filter((e) => e.id !== id);
  emit();
}

export function reportError(error: unknown) {
  const { message, hint } = humanize(error);
  // Une même panne déclenche souvent plusieurs requêtes d'un coup (elements,
  // links, relations…). On n'empile pas dix fois le même message.
  if (errors.some((e) => e.message === message)) return;
  errors = [...errors, { id: nextId++, message, hint }];
  emit();
}

// Les messages de PostgREST sont exacts mais illisibles. On garde le message
// d'origine et on y ajoute ce qu'il faut faire — une erreur qui ne dit pas
// comment s'en sortir ne vaut pas mieux qu'un écran vide.
function humanize(error: unknown): { message: string; hint?: string } {
  // supabase-js ne jette pas une Error mais un PostgrestError : un objet nu
  // avec message / code / details. Lire `message` directement, plutôt que de
  // sérialiser l'objet, garde le texte exploitable par les tests ci-dessous.
  const obj = (error ?? {}) as { message?: unknown; code?: unknown };
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof obj.message === 'string'
          ? obj.message
          : JSON.stringify(error);
  const code = typeof obj.code === 'string' ? obj.code : '';

  // 42P01 : la table n'existe pas. C'est le symptôme d'un schéma jamais
  // appliqué — le cas le plus probable après un changement de modèle.
  const missingTable = /relation "?(?:public\.)?(\w+)"? does not exist/i.exec(raw);
  if (missingTable || code === '42P01') {
    const table = missingTable?.[1];
    return {
      message: table
        ? `La table "${table}" n'existe pas dans ta base.`
        : "Une table attendue n'existe pas dans ta base.",
      hint: "Ouvre Supabase → SQL Editor et exécute le contenu de supabase/schema.sql, puis recharge la page.",
    };
  }

  if (/JWT|not authenticated|invalid claim/i.test(raw)) {
    return {
      message: 'Ta session a expiré.',
      hint: 'Reconnecte-toi pour continuer.',
    };
  }

  if (
    /violates row-level security|permission denied/i.test(raw) ||
    code === '42501'
  ) {
    return {
      message: "La base a refusé l'écriture.",
      hint: 'Vérifie que les politiques RLS de supabase/schema.sql ont bien été appliquées.',
    };
  }

  if (/Failed to fetch|NetworkError|ERR_/i.test(raw)) {
    return {
      message: 'Impossible de joindre la base.',
      hint: 'Vérifie ta connexion, puis recharge la page.',
    };
  }

  return { message: raw };
}
