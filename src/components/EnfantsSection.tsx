import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, X } from 'lucide-react';
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
import { displayName } from '../lib/display';

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
        name: '',
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
    <div className="text-[17px]">
      <div className="mb-3 text-[14px] font-semibold text-ink-3">Enfants</div>
      {children.length === 0 ? (
        <p className="mb-3 text-[16px] text-ink-4">Pas encore d'enfant.</p>
      ) : (
        <div className="mb-3">
          {children.map((child, index) => (
            <div
              key={child.id}
              className="group flex items-center justify-between rounded-lg px-1 py-2 hover:bg-surface-2"
            >
              <button
                onClick={() => navigate(`/elements/${child.id}`)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left text-ink"
              >
                {/* Pastille verte : la couleur du "+". Les enfants sont
                    listés et non en pastilles (ils sont ordonnés et
                    réordonnables), le marqueur porte donc le signal. */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-fluo-child">
                  <FileText size={13} strokeWidth={2} className="text-ink" />
                </span>
                <span className="truncate">{displayName(child)}</span>
              </button>
              <span className="ml-2 hidden shrink-0 items-center gap-1 group-hover:flex">
                <button
                  onClick={() =>
                    reorderMutation.mutate({ childId: child.id, direction: 'up' })
                  }
                  disabled={index === 0}
                  aria-label="Monter"
                  className="cursor-pointer text-ink-4 hover:text-ink-2 disabled:cursor-default disabled:opacity-20"
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
                  className="cursor-pointer text-ink-4 hover:text-ink-2 disabled:cursor-default disabled:opacity-20"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeChildMutation.mutate(child.id)}
                  aria-label={`Retirer ${child.name}`}
                  className="cursor-pointer text-ink-4 hover:text-danger"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => createChildMutation.mutate()}
          disabled={createChildMutation.isPending}
          className="flex cursor-pointer items-center gap-1.5 text-ink-3 hover:text-ink disabled:cursor-default disabled:opacity-50"
        >
          <Plus size={15} strokeWidth={1.75} />
          Nouvelle sous-page
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
