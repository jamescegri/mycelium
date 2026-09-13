import type { TemporalRelation } from '../types';

interface TimelineEdge {
  before: string;
  after: string;
}

// BEFORE et AFTER décrivent la même notion (un ordre chronologique) depuis
// deux points de vue différents ; on les ramène à une seule forme d'arête
// orientée (avant → après) pour construire l'ordre.
export function normalizeEdges(relations: TemporalRelation[]): TimelineEdge[] {
  return relations.map((r) =>
    r.type === 'BEFORE'
      ? { before: r.element_a, after: r.element_b }
      : { before: r.element_b, after: r.element_a }
  );
}

// Tri topologique (Kahn). Un Element sans dépendance restante sort en
// premier. Si l'utilisateur crée des relations contradictoires (un cycle),
// les Elements concernés ne peuvent jamais atteindre 0 dépendance : on les
// ajoute quand même à la fin plutôt que de bloquer l'affichage.
export function topologicalOrder(
  nodeIds: string[],
  edges: TimelineEdge[]
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const { before, after } of edges) {
    if (!adjacency.has(before) || !inDegree.has(after)) continue;
    adjacency.get(before)!.push(after);
    inDegree.set(after, (inDegree.get(after) ?? 0) + 1);
  }

  const queue = nodeIds.filter((id) => inDegree.get(id) === 0);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    ordered.push(id);
    for (const next of adjacency.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  const ordSet = new Set(ordered);
  const remaining = nodeIds.filter((id) => !ordSet.has(id));
  return [...ordered, ...remaining];
}
