import {
  createTemporalRelation,
  deleteTemporalRelation,
} from './temporal';
import { updateElement } from './elements';
import type { Element, TemporalRelation } from '../types';

// La chronologie est une chaîne : chaque Element placé est relié à ses
// voisins immédiats. C'est ce qui permet à l'utilisateur de raisonner en
// "où ça se situe" pendant que la base continue de stocker des BEFORE/AFTER.
//
// Aucune fonction de ce module n'expose la notion de BEFORE/AFTER à
// l'interface : on y parle d'emplacement (entre tel et tel), jamais de
// relation. C'est la seule frontière à tenir pour que l'abstraction ne
// fuie pas dans l'UI.

interface Edge {
  before: string;
  after: string;
}

function toEdges(relations: TemporalRelation[]): Edge[] {
  return relations.map((r) =>
    r.type === 'BEFORE'
      ? { before: r.element_a, after: r.element_b }
      : { before: r.element_b, after: r.element_a }
  );
}

// Ordre de la chronologie. Tri topologique, mais déterministe : quand
// plusieurs Elements peuvent venir ensuite (aucune contrainte entre eux),
// on prend systématiquement le plus ancien. Sans ça, un Element fraîchement
// placé pourrait sauter en tête d'un affichage à l'autre.
export function chronologyOrder(
  elements: Element[],
  relations: TemporalRelation[]
): Element[] {
  const inTimeline = elements.filter((e) => e.timeline);
  const byId = new Map(inTimeline.map((e) => [e.id, e]));
  const ids = inTimeline.map((e) => e.id);

  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const next = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const { before, after } of toEdges(relations)) {
    if (!byId.has(before) || !byId.has(after)) continue;
    next.get(before)!.push(after);
    inDegree.set(after, (inDegree.get(after) ?? 0) + 1);
  }

  const seniority = (id: string) => byId.get(id)?.created_at ?? '';
  const ready = ids.filter((id) => inDegree.get(id) === 0);
  const ordered: string[] = [];

  while (ready.length > 0) {
    ready.sort((a, b) => seniority(a).localeCompare(seniority(b)));
    const id = ready.shift() as string;
    ordered.push(id);
    for (const n of next.get(id) ?? []) {
      inDegree.set(n, (inDegree.get(n) ?? 0) - 1);
      if (inDegree.get(n) === 0) ready.push(n);
    }
  }

  // Un cycle (contraintes contradictoires) empêcherait ces Elements de
  // jamais atteindre 0 : on les montre quand même, plutôt que de les faire
  // disparaître de la chronologie sans explication.
  const placed = new Set(ordered);
  for (const id of ids) if (!placed.has(id)) ordered.push(id);

  return ordered.map((id) => byId.get(id) as Element);
}

// Relations touchant cet Element — celles qu'il faut défaire pour le
// déplacer ou le retirer.
function relationsTouching(relations: TemporalRelation[], id: string) {
  return relations.filter((r) => r.element_a === id || r.element_b === id);
}

// L'arête directe entre deux voisins, s'il en existe une.
function edgeBetween(
  relations: TemporalRelation[],
  beforeId: string,
  afterId: string
) {
  return relations.find(
    (r) =>
      (r.type === 'BEFORE' &&
        r.element_a === beforeId &&
        r.element_b === afterId) ||
      (r.type === 'AFTER' &&
        r.element_a === afterId &&
        r.element_b === beforeId)
  );
}

// Poser un Element à un emplacement : entre `afterId` (le voisin de
// gauche) et `beforeId` (celui de droite). L'un des deux peut être null —
// début ou fin de chronologie, ou toute première entrée.
//
// On recoud systématiquement : l'Element est d'abord détaché de ses
// anciens voisins (qu'on relie entre eux pour ne pas trouer la chaîne),
// puis rattaché à ses nouveaux. Placer et déplacer sont donc la même
// opération — il n'y a pas deux chemins de code à garder cohérents.
export async function placeInChronology(
  relations: TemporalRelation[],
  elementId: string,
  previousId: string | null,
  nextId: string | null
): Promise<void> {
  const own = relationsTouching(relations, elementId);

  // Qui étaient ses voisins avant ce déplacement ?
  const edges = relations
    .map((r, i) => ({ ...toEdges([r])[0], rel: relations[i] }))
    .filter((e) => e.before === elementId || e.after === elementId);
  const oldPrev = edges.find((e) => e.after === elementId)?.before ?? null;
  const oldNext = edges.find((e) => e.before === elementId)?.after ?? null;

  await Promise.all(own.map((r) => deleteTemporalRelation(r.id)));

  // Recoudre le trou laissé derrière soi.
  if (oldPrev && oldNext && oldPrev !== nextId && oldNext !== previousId) {
    await createTemporalRelation(oldPrev, 'BEFORE', oldNext);
  }

  // S'insérer entre deux voisins : l'arête directe qui les reliait n'a plus
  // lieu d'être, sinon la chaîne garde un raccourci par-dessus le nouveau.
  if (previousId && nextId) {
    const direct = edgeBetween(relations, previousId, nextId);
    if (direct) await deleteTemporalRelation(direct.id);
  }

  if (previousId) await createTemporalRelation(previousId, 'BEFORE', elementId);
  if (nextId) await createTemporalRelation(elementId, 'BEFORE', nextId);

  await updateElement(elementId, { timeline: true });
}

// Retirer de la chronologie sans supprimer l'Element : ses voisins se
// rejoignent, il redevient un Element ordinaire.
export async function removeFromChronology(
  relations: TemporalRelation[],
  elementId: string
): Promise<void> {
  const edges = toEdges(relations);
  const prev = edges.find((e) => e.after === elementId)?.before ?? null;
  const next = edges.find((e) => e.before === elementId)?.after ?? null;

  await Promise.all(
    relationsTouching(relations, elementId).map((r) =>
      deleteTemporalRelation(r.id)
    )
  );
  if (prev && next) await createTemporalRelation(prev, 'BEFORE', next);

  await updateElement(elementId, { timeline: false });
}

// Les voisins immédiats d'un Element dans la chronologie, pour les nommer
// en clair sur sa page ("après X, avant Y").
export function neighbours(
  ordered: Element[],
  elementId: string
): { previous: Element | null; next: Element | null } {
  const i = ordered.findIndex((e) => e.id === elementId);
  if (i === -1) return { previous: null, next: null };
  return {
    previous: ordered[i - 1] ?? null,
    next: ordered[i + 1] ?? null,
  };
}
