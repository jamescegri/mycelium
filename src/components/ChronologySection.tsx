import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Clock, Plus } from 'lucide-react';
import { listElements, updateElement } from '../lib/elements';
import { listAllLinks, parentsOf } from '../lib/links';
import { listTemporalRelations } from '../lib/temporal';
import { removeFromChronology } from '../lib/chronology';
import { displayName } from '../lib/display';
import { reportError } from '../lib/errors';
import { PropertyEmpty, PropertyRow } from './PropertyRow';
import type { Element } from '../types';

// Où cet Element se situe dans le récit. On y lit un chemin — "La Chute ›
// Tome 1 › Chapitre 2" — parce que c'est ainsi qu'on se repère dans une
// histoire : par ce qui contient, pas par une position absolue.
//
// Le placement fin ne se fait pas ici mais dans la vue Chronologie, où l'on
// voit les voisins. Deux interfaces de placement concurrentes, c'est deux
// occasions de se tromper d'endroit.
export function ChronologySection({ element }: { element: Element }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  // Le chemin temporel : on remonte de parent temporel en parent temporel.
  // Les parents non temporels sont ignorés — ranger une scène dans un
  // Groupe "Brouillons" ne la situe pas dans le récit.
  const path = useMemo(() => {
    const all = elements ?? [];
    const ls = links ?? [];
    const chain: Element[] = [];
    const seen = new Set<string>([element.id]);
    let current = parentsOf(ls, all, element.id).find((p) => p.timeline);
    while (current && !seen.has(current.id)) {
      chain.unshift(current);
      seen.add(current.id);
      current = parentsOf(ls, all, current.id).find((p) => p.timeline);
    }
    return chain;
  }, [elements, links, element.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['temporal-relations'] });
    queryClient.invalidateQueries({ queryKey: ['elements'] });
    queryClient.invalidateQueries({ queryKey: ['elements', element.id] });
    queryClient.invalidateQueries({ queryKey: ['links'] });
  };

  const enterMutation = useMutation({
    mutationFn: () => updateElement(element.id, { timeline: true }),
    onSuccess: invalidate,
    onError: reportError,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFromChronology(relations ?? [], element.id),
    onSuccess: invalidate,
    onError: reportError,
  });

  return (
    <PropertyRow icon={Clock} label="Chronologie">
      {!element.timeline ? (
        <button
          onClick={() => enterMutation.mutate()}
          disabled={enterMutation.isPending}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-[13px] text-ink-3 transition hover:border-ink hover:text-ink disabled:opacity-50"
        >
          <Plus size={12} strokeWidth={2.4} />
          Situer dans le temps
        </button>
      ) : (
        <>
          {path.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1 text-[14px]">
              {path.map((ancestor) => (
                <span key={ancestor.id} className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/elements/${ancestor.id}`)}
                    className="max-w-[12rem] truncate font-medium transition hover:underline"
                  >
                    {displayName(ancestor)}
                  </button>
                  <ChevronRight
                    size={12}
                    strokeWidth={2}
                    className="shrink-0 text-ink-4"
                  />
                </span>
              ))}
              <span className="text-ink-4">ici</span>
            </span>
          ) : (
            <PropertyEmpty>Dans le temps, à la racine</PropertyEmpty>
          )}

          <button
            onClick={() => navigate('/temporel')}
            className="rounded-full px-2 py-0.5 text-[13px] text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            Voir
          </button>
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="rounded-full px-2 py-0.5 text-[13px] text-ink-3 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            Retirer
          </button>
        </>
      )}
    </PropertyRow>
  );
}
