import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CornerLeftUp, X } from 'lucide-react';
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
import { PropertyEmpty, PropertyRow } from './PropertyRow';
import type { Element } from '../types';
import { displayName } from '../lib/display';

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
    <PropertyRow icon={CornerLeftUp} label="Parents">
      {parents.length === 0 && <PropertyEmpty>À la racine</PropertyEmpty>}

      {/* Fond cyan : c'est la couleur du "@" dans l'éditeur. Un parent se
          reconnaît à sa teinte, ici comme dans le texte. */}
      {parents.map((parent) => (
        <span
          key={parent.id}
          className="group inline-flex items-center gap-0.5 rounded-full bg-fluo-parent py-1 pr-1.5 pl-3 text-[14px] font-medium text-ink"
        >
          <button
            onClick={() => navigate(`/elements/${parent.id}`)}
            className="max-w-[14rem] cursor-pointer truncate"
          >
            {displayName(parent)}
          </button>
          <button
            onClick={() => removeParentMutation.mutate(parent.id)}
            aria-label={`Retirer de ${displayName(parent)}`}
            className="hidden cursor-pointer px-0.5 text-ink/45 transition group-hover:inline hover:text-ink"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </span>
      ))}

      <ElementPicker
        excludeIds={excludeIds}
        placeholder="+ parent…"
        onPick={(picked) => {
          if (links && wouldCreateCycle(links, picked.id, element.id)) return;
          addParentMutation.mutate(picked);
        }}
      />
    </PropertyRow>
  );
}
