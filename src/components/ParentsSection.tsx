import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listElements } from '../lib/elements';
import {
  getDescendantIds,
  linkChild,
  listAllLinks,
  parentsOf,
  unlinkChild,
  wouldCreateCycle,
} from '../lib/links';
import { ElementPicker } from './ElementPicker';
import type { Element } from '../types';

// "Parents" : les Groupes auxquels cet Element appartient — il peut y en
// avoir plusieurs (rien n'est figé). Toujours visible, jamais replié :
// c'est une info structurelle, pas une connexion secondaire.
export function ParentsSection({ element }: { element: Element }) {
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

  const parents = links && elements ? parentsOf(links, elements, element.id) : [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['links'] });
  };
  const addParentMutation = useMutation({
    mutationFn: (parent: Element) => linkChild(parent.id, element.id),
    onSuccess: invalidate,
  });
  const removeParentMutation = useMutation({
    mutationFn: (parentId: string) => unlinkChild(parentId, element.id),
    onSuccess: invalidate,
  });

  // On ne peut pas choisir comme parent l'Element lui-même, un de ses
  // propres descendants (ça créerait une boucle), ni un parent déjà lié.
  const excludeIds = [
    element.id,
    ...(links ? getDescendantIds(links, element.id) : []),
    ...parents.map((p) => p.id),
  ];

  return (
    <div className="text-base">
      <div className="mb-2 text-xs text-neutral-500">
        Parents
      </div>
      {parents.length === 0 ? (
        <p className="mb-2 text-neutral-400">
          Aucun parent — cet Element est à la racine.
        </p>
      ) : (
        <div className="mb-2 flex flex-wrap gap-x-1 gap-y-1">
          {parents.map((parent, i) => (
            <span key={parent.id} className="flex items-center gap-1">
              <button
                onClick={() => navigate(`/elements/${parent.id}`)}
                className="text-neutral-700 hover:text-yellow-600"
              >
                {parent.name || 'Sans titre'}
              </button>
              <button
                onClick={() => removeParentMutation.mutate(parent.id)}
                aria-label={`Retirer de ${parent.name}`}
                className="text-neutral-300 hover:text-red-600"
              >
                ×
              </button>
              {i < parents.length - 1 && (
                <span className="text-neutral-300">,</span>
              )}
            </span>
          ))}
        </div>
      )}
      <ElementPicker
        excludeIds={excludeIds}
        placeholder="+ Ajouter un parent…"
        onPick={(picked) => {
          if (links && wouldCreateCycle(links, picked.id, element.id)) return;
          addParentMutation.mutate(picked);
        }}
      />
    </div>
  );
}
