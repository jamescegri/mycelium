import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDescendantIds, listElements, updateElement } from '../lib/elements';
import {
  addTagToElement,
  listTagsForElement,
  removeTagFromElement,
} from '../lib/tags';
import {
  addElementToCollection,
  listCollectionsForElement,
  removeElementFromCollection,
} from '../lib/collections';
import { ElementPicker } from './ElementPicker';
import { FAMILIES } from '../types';
import type { Element, ElementFamily } from '../types';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

// Famille, parent, tags, collections : des métadonnées d'organisation, pas
// le sujet de la page. Rangées sous un seul repli pour ne jamais rivaliser
// avec le contenu écrit — l'inverse d'une fiche où chaque champ réclame sa
// propre ligne visible en permanence.
export function PropertiesDisclosure({ element }: { element: Element }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allElements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });

  const setFamilyMutation = useMutation({
    mutationFn: (family: ElementFamily) =>
      updateElement(element.id, { family }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', element.id] });
    },
  });
  const setParentMutation = useMutation({
    mutationFn: (parentId: string | null) =>
      updateElement(element.id, { parent_id: parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', element.id] });
    },
  });

  const { data: tags } = useQuery({
    queryKey: ['tags', element.id],
    queryFn: () => listTagsForElement(element.id),
  });
  const [newTagName, setNewTagName] = useState('');
  const addTagMutation = useMutation({
    mutationFn: (tagName: string) => addTagToElement(element.id, tagName),
    onSuccess: () => {
      setNewTagName('');
      queryClient.invalidateQueries({ queryKey: ['tags', element.id] });
    },
  });
  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) => removeTagFromElement(element.id, tagId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tags', element.id] }),
  });

  const { data: elementCollections } = useQuery({
    queryKey: ['element-collections', element.id],
    queryFn: () => listCollectionsForElement(element.id),
  });
  const [newCollectionName, setNewCollectionName] = useState('');
  const addToCollectionMutation = useMutation({
    mutationFn: (collectionName: string) =>
      addElementToCollection(element.id, collectionName),
    onSuccess: () => {
      setNewCollectionName('');
      queryClient.invalidateQueries({
        queryKey: ['element-collections', element.id],
      });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
  const removeFromCollectionMutation = useMutation({
    mutationFn: (collectionId: string) =>
      removeElementFromCollection(collectionId, element.id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['element-collections', element.id],
      }),
  });

  const parentElement = allElements?.find((e) => e.id === element.parent_id);
  const parentPickerExcludeIds = allElements
    ? [element.id, ...getDescendantIds(allElements, element.id)]
    : [element.id];

  return (
    <div className="text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-neutral-500 hover:text-neutral-300"
      >
        {open ? '— Propriétés' : 'Propriétés'}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-neutral-600">
              Famille
            </span>
            <select
              value={element.family}
              onChange={(e) =>
                setFamilyMutation.mutate(e.target.value as ElementFamily)
              }
              className="border-b border-neutral-800 bg-transparent py-1 text-sm text-neutral-300 outline-none focus:border-neutral-500"
            >
              {FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {FAMILY_LABEL[f]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-neutral-600">
              Parent
            </span>
            {parentElement ? (
              <>
                <button
                  onClick={() => navigate(`/elements/${parentElement.id}`)}
                  className="text-neutral-300 hover:underline"
                >
                  {parentElement.name}
                </button>
                <button
                  onClick={() => setParentMutation.mutate(null)}
                  className="text-xs text-neutral-600 hover:text-red-400"
                >
                  (retirer)
                </button>
              </>
            ) : (
              <ElementPicker
                excludeIds={parentPickerExcludeIds}
                placeholder="Choisir un parent…"
                onPick={(picked) => setParentMutation.mutate(picked.id)}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-neutral-600">
              Tags
            </span>
            {tags?.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 text-xs text-neutral-400"
              >
                #{tag.name}
                <button
                  onClick={() => removeTagMutation.mutate(tag.id)}
                  aria-label={`Retirer le tag ${tag.name}`}
                  className="text-neutral-600 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTagName.trim()) {
                  e.preventDefault();
                  addTagMutation.mutate(newTagName);
                }
              }}
              placeholder="+ tag"
              className="w-20 border-b border-neutral-800 bg-transparent px-1 py-1 text-xs text-neutral-400 outline-none focus:border-neutral-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-neutral-600">
              Collections
            </span>
            {elementCollections?.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1 text-xs text-neutral-400"
              >
                <button
                  onClick={() => navigate(`/collections/${c.id}`)}
                  className="hover:underline"
                >
                  {c.name}
                </button>
                <button
                  onClick={() => removeFromCollectionMutation.mutate(c.id)}
                  aria-label={`Retirer de ${c.name}`}
                  className="text-neutral-600 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCollectionName.trim()) {
                  e.preventDefault();
                  addToCollectionMutation.mutate(newCollectionName);
                }
              }}
              placeholder="+ collection"
              className="w-28 border-b border-dashed border-neutral-800 bg-transparent px-1 py-1 text-xs text-neutral-400 outline-none focus:border-neutral-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
