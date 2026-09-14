import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { updateElement } from '../lib/elements';
import {
  addTagToElement,
  listTagsForElement,
  removeTagFromElement,
} from '../lib/tags';
import { Pill } from './Pill';
import { FAMILIES } from '../types';
import type { Element, ElementFamily } from '../types';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Temps',
  ELEMENTS: 'Element',
};

// Famille et tags : des métadonnées d'organisation, pas le sujet de la
// page. Le rangement (parents/enfants) a ses propres sections, toujours
// visibles, juste en dessous — pas ici.
export function PropertiesDisclosure({ element }: { element: Element }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const setFamilyMutation = useMutation({
    mutationFn: (family: ElementFamily) =>
      updateElement(element.id, { family }),
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

  return (
    <div className="text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-ink-3 hover:text-ink"
      >
        {open ? '— Propriétés' : 'Propriétés'}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-ink-3">
              Famille
            </span>
            <select
              value={element.family}
              onChange={(e) =>
                setFamilyMutation.mutate(e.target.value as ElementFamily)
              }
              className="border-b border-line bg-transparent py-1 text-sm text-ink-2 outline-none focus:border-ink-4"
            >
              {FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {FAMILY_LABEL[f]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-ink-3">
              Tags
            </span>
            {tags?.map((tag) => (
              <Pill key={tag.id} className="pr-1.5 text-xs">
                #{tag.name}
                <button
                  onClick={() => removeTagMutation.mutate(tag.id)}
                  aria-label={`Retirer le tag ${tag.name}`}
                  className="cursor-pointer text-ink-4 hover:text-danger"
                >
                  <X size={11} strokeWidth={2} />
                </button>
              </Pill>
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
              className="w-20 border-b border-line bg-transparent px-1 py-1 text-xs text-ink-2 outline-none focus:border-ink-4"
            />
          </div>
        </div>
      )}
    </div>
  );
}
