import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CornerDownRight, Plus, X } from 'lucide-react';
import { createElement } from '../lib/elements';
import { listElements } from '../lib/elements';
import {
  childrenOf,
  getAncestorIds,
  linkChild,
  listAllLinks,
  reorderChild,
  unlinkChild,
} from '../lib/links';
import { displayName } from '../lib/display';
import { ElementPicker } from './ElementPicker';
import { PropertyEmpty, PropertyRow } from './PropertyRow';
import type { Element } from '../types';

// Les enfants en pastilles vertes — la couleur du "+" dans l'éditeur, pour
// qu'un enfant se reconnaisse à sa teinte ici comme dans le texte. Ils sont
// ordonnés, d'où les flèches qui n'apparaissent qu'au survol : l'ordre
// compte, mais pas au point d'occuper la ligne en permanence.
export function EnfantsSection({ element }: { element: Element }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });

  const children =
    elements && links ? childrenOf(links, elements, element.id) : [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['links'] });
    queryClient.invalidateQueries({ queryKey: ['elements'] });
  };

  const createChildMutation = useMutation({
    mutationFn: async () => {
      const created = await createElement({ name: '' });
      await linkChild(element.id, created.id);
      return created;
    },
    onSuccess: (created) => {
      invalidate();
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });
  const addChildMutation = useMutation({
    mutationFn: (child: Element) => linkChild(element.id, child.id),
    onSuccess: invalidate,
  });
  const removeChildMutation = useMutation({
    mutationFn: (childId: string) => unlinkChild(element.id, childId),
    onSuccess: invalidate,
  });
  const reorderMutation = useMutation({
    mutationFn: ({
      childId,
      direction,
    }: {
      childId: string;
      direction: 'up' | 'down';
    }) => reorderChild(children, element.id, childId, direction),
    onSuccess: invalidate,
  });

  // On ne peut pas rattacher comme enfant l'Element lui-même, un de ses
  // propres ancêtres (ça créerait une boucle dans l'autre sens), ni un
  // enfant déjà lié.
  const excludeIds = [
    element.id,
    ...(links ? getAncestorIds(links, element.id) : []),
    ...children.map((c) => c.id),
  ];

  return (
    <PropertyRow icon={CornerDownRight} label="Enfants">
      {children.length === 0 && <PropertyEmpty>Aucun</PropertyEmpty>}

      {children.map((child, index) => (
        <span
          key={child.id}
          className="group inline-flex items-center gap-0.5 rounded-full bg-fluo-child py-1 pr-1.5 pl-3 text-[14px] font-medium text-ink"
        >
          <button
            onClick={() => navigate(`/elements/${child.id}`)}
            className="max-w-[14rem] cursor-pointer truncate"
          >
            {displayName(child)}
          </button>
          <span className="hidden items-center group-hover:inline-flex">
            <button
              onClick={() =>
                reorderMutation.mutate({ childId: child.id, direction: 'up' })
              }
              disabled={index === 0}
              aria-label={`Monter ${displayName(child)}`}
              className="cursor-pointer px-0.5 text-ink/45 transition hover:text-ink disabled:opacity-20"
            >
              ↑
            </button>
            <button
              onClick={() =>
                reorderMutation.mutate({ childId: child.id, direction: 'down' })
              }
              disabled={index === children.length - 1}
              aria-label={`Descendre ${displayName(child)}`}
              className="cursor-pointer px-0.5 text-ink/45 transition hover:text-ink disabled:opacity-20"
            >
              ↓
            </button>
            <button
              onClick={() => removeChildMutation.mutate(child.id)}
              aria-label={`Retirer ${displayName(child)}`}
              className="cursor-pointer px-0.5 text-ink/45 transition hover:text-ink"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </span>
        </span>
      ))}

      <button
        onClick={() => createChildMutation.mutate()}
        disabled={createChildMutation.isPending}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-[13px] text-ink-3 transition hover:border-ink hover:text-ink disabled:opacity-50"
      >
        <Plus size={12} strokeWidth={2.4} />
        Sous-page
      </button>

      <ElementPicker
        excludeIds={excludeIds}
        allowCreate={false}
        placeholder="+ rattacher…"
        onPick={(picked) => addChildMutation.mutate(picked)}
      />
    </PropertyRow>
  );
}
