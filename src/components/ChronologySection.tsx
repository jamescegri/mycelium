import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Clock, X } from 'lucide-react';
import { createElement, listElements } from '../lib/elements';
import { getDescendantIds, listAllLinks, rootElements, childrenOf, hasChildren } from '../lib/links';
import { listTemporalRelations } from '../lib/temporal';
import {
  chronologyOrder,
  neighbours,
  placeInChronology,
  removeFromChronology,
} from '../lib/chronology';
import { displayName } from '../lib/display';
import type { Element, ElementLink, TemporalRelation } from '../types';

// Constantes de repli stables : `?? []` fabrique un tableau neuf à chaque
// rendu, ce qui invalide tous les useMemo qui en dépendent.
const NO_ELEMENTS: Element[] = [];
const NO_LINKS: ElementLink[] = [];
const NO_RELATIONS: TemporalRelation[] = [];

// La chronologie est une dimension optionnelle de n'importe quel Element,
// pas une catégorie : rien ici ne demande "de quel type est cet Element ?".
// On y parle d'emplacement — jamais de relation "avant"/"après", qui reste
// la mécanique interne (voir lib/chronology.ts).
export function ChronologySection({ element }: { element: Element }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [placing, setPlacing] = useState(false);

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const ordered = useMemo(
    () => chronologyOrder(elements ?? NO_ELEMENTS, relations ?? NO_RELATIONS),
    [elements, relations]
  );
  const { previous, next } = neighbours(ordered, element.id);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['temporal-relations'] });
    queryClient.invalidateQueries({ queryKey: ['elements'] });
    queryClient.invalidateQueries({ queryKey: ['elements', element.id] });
  };

  const removeMutation = useMutation({
    mutationFn: () => removeFromChronology(relations ?? [], element.id),
    onSuccess: invalidate,
  });

  return (
    <div className="text-[17px]">
      <div className="mb-3 text-[14px] font-semibold text-ink-3">
        Chronologie
      </div>

      {!element.timeline ? (
        <button
          onClick={() => setPlacing(true)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[16px] text-ink-3 transition hover:bg-surface-2 hover:text-ink"
        >
          <Clock size={16} strokeWidth={2} />
          Placer dans la chronologie
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* L'emplacement se lit en français, pas en relations. */}
          <span className="text-ink-2">
            {previous && next ? (
              <>
                Entre{' '}
                <NeighbourLink el={previous} onOpen={navigate} /> et{' '}
                <NeighbourLink el={next} onOpen={navigate} />
              </>
            ) : previous ? (
              <>
                Après <NeighbourLink el={previous} onOpen={navigate} />, en fin
                de chronologie
              </>
            ) : next ? (
              <>
                Au tout début, avant{' '}
                <NeighbourLink el={next} onOpen={navigate} />
              </>
            ) : (
              'Seul Element de la chronologie pour le moment'
            )}
          </span>
          <button
            onClick={() => setPlacing(true)}
            className="rounded-lg px-2 py-1 text-[15px] text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            Déplacer
          </button>
          <button
            onClick={() => removeMutation.mutate()}
            className="rounded-lg px-2 py-1 text-[15px] text-ink-4 transition hover:bg-surface-2 hover:text-ink"
          >
            Retirer
          </button>
        </div>
      )}

      {placing && (
        <ChronologyPlacer
          element={element}
          onClose={() => setPlacing(false)}
          onPlaced={invalidate}
        />
      )}
    </div>
  );
}

function NeighbourLink({
  el,
  onOpen,
}: {
  el: Element;
  onOpen: (to: string) => void;
}) {
  return (
    <button
      onClick={() => onOpen(`/elements/${el.id}`)}
      className="font-medium text-ink underline decoration-ink-4 underline-offset-4 transition hover:decoration-ink"
    >
      {displayName(el)}
    </button>
  );
}

// Le panneau de placement. Il montre la chronologie telle qu'elle est et on
// clique DANS un intervalle : c'est ce qui remplace la saisie d'une
// relation. Trois façons de trouver l'endroit — la parcourir, la filtrer
// par nom, ou la restreindre à un Groupe.
function ChronologyPlacer({
  element,
  onClose,
  onPlaced,
}: {
  element: Element;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [groupStack, setGroupStack] = useState<string[]>([]);

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const all = elements ?? NO_ELEMENTS;
  const allLinks = links ?? NO_LINKS;
  const allRelations = relations ?? NO_RELATIONS;

  const ordered = useMemo(
    () => chronologyOrder(all, allRelations),
    [all, allRelations]
  );

  const currentGroupId = groupStack[groupStack.length - 1] ?? null;

  // Restreindre la chronologie à un Groupe = ne garder que ses descendants.
  // On ne montre pas l'Element qu'on est en train de placer : on ne peut pas
  // l'insérer à côté de lui-même.
  const visible = useMemo(() => {
    let list = ordered.filter((e) => e.id !== element.id);
    if (currentGroupId) {
      const inside = getDescendantIds(allLinks, currentGroupId);
      list = list.filter((e) => inside.has(e.id));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => displayName(e).toLowerCase().includes(q));
    return list;
  }, [ordered, element.id, currentGroupId, allLinks, query]);

  // Les Groupes parcourables au niveau courant.
  const browsable = useMemo(() => {
    const level = currentGroupId
      ? childrenOf(allLinks, all, currentGroupId)
      : rootElements(allLinks, all);
    return level.filter((e) => hasChildren(allLinks, e.id));
  }, [currentGroupId, allLinks, all]);

  const placeMutation = useMutation({
    mutationFn: ({
      previousId,
      nextId,
      createName,
    }: {
      previousId: string | null;
      nextId: string | null;
      createName?: string;
    }) => placeAt(previousId, nextId, createName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temporal-relations'] });
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      onPlaced();
      onClose();
    },
  });

  async function placeAt(
    previousId: string | null,
    nextId: string | null,
    createName?: string
  ) {
    // "Créer un Element ici" : sert à poser un repère quand la chronologie
    // est encore vide ou trop clairsemée pour viser un intervalle.
    const targetId = createName
      ? (await createElement({ name: createName, timeline: true })).id
      : element.id;
    await placeInChronology(allRelations, targetId, previousId, nextId);
  }

  // Les intervalles : avant le premier, entre chaque paire, après le dernier.
  const slots: { previousId: string | null; nextId: string | null }[] = [
    { previousId: null, nextId: visible[0]?.id ?? null },
    ...visible.map((el, i) => ({
      previousId: el.id,
      nextId: visible[i + 1]?.id ?? null,
    })),
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-ink/25 px-4 py-[8vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[34rem] flex-col overflow-hidden rounded-2xl border-2 border-ink bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink-3">
              Où placer cet Element ?
            </div>
            <div className="truncate text-[19px] font-semibold text-ink">
              {displayName(element)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 text-ink-4 transition hover:text-ink"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="border-b border-line px-5 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un moment…"
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-4"
          />
        </div>

        {/* Parcourir les Groupes pour restreindre la chronologie à un arc */}
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-5 py-2.5 text-[13.5px] text-ink-3">
          <button
            onClick={() => setGroupStack([])}
            className="transition hover:text-ink"
          >
            Toute la chronologie
          </button>
          {groupStack.map((id, i) => {
            const g = all.find((e) => e.id === id);
            return (
              <span key={id} className="flex items-center gap-1">
                <ChevronRight size={13} strokeWidth={2} className="opacity-50" />
                <button
                  onClick={() => setGroupStack(groupStack.slice(0, i + 1))}
                  className="transition hover:text-ink"
                >
                  {g ? displayName(g) : '…'}
                </button>
              </span>
            );
          })}
          {browsable.length > 0 && (
            <span className="ml-auto flex flex-wrap gap-1">
              {browsable.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroupStack([...groupStack, g.id])}
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] text-ink-2 transition hover:bg-surface-3 hover:text-ink"
                >
                  {displayName(g)}
                </button>
              ))}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {visible.length === 0 && (
            <p className="mb-3 text-[15px] text-ink-4">
              {query || currentGroupId
                ? 'Aucun moment ici.'
                : "La chronologie est vide — cet Element en sera le premier."}
            </p>
          )}

          {slots.map((slot, i) => (
            <div key={i}>
              <Slot
                onPlace={() => placeMutation.mutate(slot)}
                onCreate={(name) =>
                  placeMutation.mutate({ ...slot, createName: name })
                }
                disabled={placeMutation.isPending}
              />
              {visible[i] && (
                <div className="flex items-center gap-2.5 py-2 text-[16px] text-ink">
                  <Clock size={14} strokeWidth={2} className="shrink-0 text-ink-4" />
                  <span className="truncate">{displayName(visible[i])}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Un intervalle. Discret au repos pour ne pas transformer la liste en
// formulaire, explicite au survol.
function Slot({
  onPlace,
  onCreate,
  disabled,
}: {
  onPlace: () => void;
  onCreate: (name: string) => void;
  disabled: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  if (creating) {
    return (
      <form
        className="flex items-center gap-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim());
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !name && setCreating(false)}
          placeholder="Nom du nouvel Element…"
          className="min-w-0 flex-1 border-b border-ink bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-4"
        />
        <button
          type="submit"
          disabled={disabled}
          className="shrink-0 text-[14px] font-semibold text-ink disabled:opacity-50"
        >
          Créer ici
        </button>
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-2 py-0.5">
      <button
        onClick={onPlace}
        disabled={disabled}
        className="flex flex-1 items-center gap-2 text-left text-[13.5px] text-ink-4 opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
      >
        <span className="h-px flex-1 bg-fluo-parent" />
        <span className="font-semibold text-ink">Insérer ici</span>
        <span className="h-px flex-1 bg-fluo-parent" />
      </button>
      <button
        onClick={() => setCreating(true)}
        className="shrink-0 text-[13px] text-ink-4 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        + créer
      </button>
    </div>
  );
}
