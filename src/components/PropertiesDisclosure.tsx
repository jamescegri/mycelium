import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  addTagToElement,
  listTagsForElement,
  removeTagFromElement,
} from '../lib/tags';
import { Pill } from './Pill';
import type { Element } from '../types';

// Les tags : une métadonnée de filtrage, pas le sujet de la
// page. Le rangement (parents/enfants) a ses propres sections, toujours
// visibles, juste en dessous — pas ici.
export function PropertiesDisclosure({ element }: { element: Element }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

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
    <div className="text-[16px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-ink-3 hover:text-ink"
      >
        {open ? '— Propriétés' : 'Propriétés'}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-[13.5px] text-ink-3">
              Tags
            </span>
            {tags?.map((tag) => (
              <Pill key={tag.id} className="pr-1.5 text-[13.5px]">
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
              className="w-20 border-b border-line bg-transparent px-1 py-1 text-[13.5px] text-ink-2 outline-none focus:border-ink-4"
            />
          </div>
        </div>
      )}
    </div>
  );
}
