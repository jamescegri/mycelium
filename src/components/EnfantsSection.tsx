import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createElement, listElements } from '../lib/elements';
import {
  childrenOf,
  getAncestorIds,
  linkChild,
  listAllLinks,
  reorderChild,
  unlinkChild,
} from '../lib/links';
import { ElementPicker } from './ElementPicker';
import type { Element } from '../types';

// "Enfants" : ce que cet Element contient (il en devient un Groupe dès
// qu'il en a au moins un). Un enfant peut aussi appartenir à d'autres
// Groupes en parallèle — rien n'est figé. "+ Nouvelle sous-page" crée
// l'enfant immédiatement, sans formulaire, et y amène pour écrire tout de
// suite.
export function EnfantsSection({ element }: { element: Element }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({
    queryKey: ['links'],
    queryFn: listAllLinks,
  });

  const children = links && elements ? childrenOf(links, elements, element.id) : [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['links'] });
  };

  const createChildMutation = useMutation({
    mutationFn: async () => {
      const created = await createElement({
        name: 'Sans titre',
        family: element.family,
      });
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
    <div className="text-sm">
      <div className="mb-1.5 text-xs text-neutral-500">Enfants</div>
      {children.length === 0 ? (
        <p className="mb-2 text-neutral-400">Pas encore d'enfant.</p>
      ) : (
        <div className="mb-2">
          {children.map((child, index) => (
            <div
              key={child.id}
              className="group flex items-center justify-between py-1"
            >
              <button
                onClick={() => navigate(`/elements/${child.id}`)}
                className="truncate text-left text-neutral-700 hover:text-yellow-600"
              >
                {child.name || 'Sans titre'}
              </button>
              <span className="ml-2 hidden shrink-0 items-center gap-1 group-hover:flex">
                <button
                  onClick={() =>
                    reorderMutation.mutate({ childId: child.id, direction: 'up' })
                  }
                  disabled={index === 0}
                  aria-label="Monter"
                  className="text-neutral-300 hover:text-neutral-600 disabled:opacity-20"
                >
                  ↑
                </button>
                <button
                  onClick={() =>
                    reorderMutation.mutate({
                      childId: child.id,
                      direction: 'down',
                    })
                  }
                  disabled={index === children.length - 1}
                  aria-label="Descendre"
                  className="text-neutral-300 hover:text-neutral-600 disabled:opacity-20"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeChildMutation.mutate(child.id)}
                  aria-label={`Retirer ${child.name}`}
                  className="text-neutral-300 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => createChildMutation.mutate()}
          disabled={createChildMutation.isPending}
          className="text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
        >
          + Nouvelle sous-page
        </button>
        <ElementPicker
          excludeIds={excludeIds}
          allowCreate={false}
          placeholder="+ Rattacher un Element existant…"
          onPick={(picked) => addChildMutation.mutate(picked)}
        />
      </div>
    </div>
  );
}
