import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listElements } from '../lib/elements';
import { listTemporalRelations } from '../lib/temporal';
import { normalizeEdges, topologicalOrder } from '../lib/timeline';
import { Layout } from '../components/Layout';
import type { Element, ElementFamily } from '../types';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

// Vue dérivée : aucune donnée n'est stockée ici. L'ordre vient uniquement
// des relations BEFORE/AFTER portées par les Elements eux-mêmes (section
// "Position temporelle" sur leur page).
export function TimelinePage() {
  const navigate = useNavigate();
  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const ordered = useMemo(() => {
    if (!elements || !relations || relations.length === 0) return [];
    const edges = normalizeEdges(relations);
    const nodeIds = [
      ...new Set(relations.flatMap((r) => [r.element_a, r.element_b])),
    ];
    const byId = new Map(elements.map((e) => [e.id, e]));
    return topologicalOrder(nodeIds, edges)
      .map((id) => byId.get(id))
      .filter((e): e is Element => !!e);
  }, [elements, relations]);

  return (
    <Layout>
      <h1 className="mb-6 text-lg font-semibold">Timeline</h1>
      {ordered.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Aucune position temporelle définie pour l'instant. Depuis la page
          d'un Element, section "Position temporelle", relie-le à un autre
          Element avec "avant" ou "après" pour le faire apparaître ici.
        </p>
      ) : (
        <ol className="relative border-l border-neutral-800 pl-6">
          {ordered.map((el) => (
            <li key={el.id} className="relative mb-5 last:mb-0">
              <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-yellow-500" />
              <button
                onClick={() => navigate(`/elements/${el.id}`)}
                className="text-sm text-neutral-100 hover:underline"
              >
                {el.name}
              </button>
              <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                {FAMILY_LABEL[el.family]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Layout>
  );
}
