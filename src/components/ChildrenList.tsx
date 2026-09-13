import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createElement, reorderSibling } from '../lib/elements';
import type { Element, ElementFamily } from '../types';

// Sous-pages d'un niveau (racine d'une famille, ou enfants directs d'un
// Element). Cliquer une ligne NAVIGUE — c'est de la hiérarchie ("où est-ce
// que je range ça ?"), jamais un aperçu : ça reste pour les connexions.
// "+ Nouvelle sous-page" ne montre aucun formulaire : ça crée tout de
// suite un Element "Sans titre" et y amène, prêt à être renommé/écrit.
export function ChildrenList({
  items,
  parentId,
  defaultFamily,
}: {
  items: Element[];
  parentId: string | null;
  defaultFamily: ElementFamily;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      createElement({ name: 'Sans titre', family: defaultFamily, parentId }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({
      elementId,
      direction,
    }: {
      elementId: string;
      direction: 'up' | 'down';
    }) => reorderSibling(items, elementId, direction),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['elements'] }),
  });

  return (
    <div>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="group flex items-center justify-between py-1.5"
        >
          <button
            onClick={() => navigate(`/elements/${item.id}`)}
            className="truncate text-left text-[15px] text-neutral-200 hover:text-yellow-500"
          >
            {item.name || 'Sans titre'}
          </button>
          <span className="ml-2 hidden shrink-0 items-center gap-1 group-hover:flex">
            <button
              onClick={() =>
                reorderMutation.mutate({ elementId: item.id, direction: 'up' })
              }
              disabled={index === 0}
              aria-label="Monter"
              className="text-neutral-600 hover:text-neutral-300 disabled:opacity-20"
            >
              ↑
            </button>
            <button
              onClick={() =>
                reorderMutation.mutate({
                  elementId: item.id,
                  direction: 'down',
                })
              }
              disabled={index === items.length - 1}
              aria-label="Descendre"
              className="text-neutral-600 hover:text-neutral-300 disabled:opacity-20"
            >
              ↓
            </button>
          </span>
        </div>
      ))}

      <button
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="mt-1 text-sm text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
      >
        + Nouvelle sous-page
      </button>
    </div>
  );
}
