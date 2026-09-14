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

// Les tags sont visibles d'emblée, au même rang que Parents et Enfants :
// ce sont trois façons de dire où un Element se situe, et les replier
// reviendrait à faire croire qu'ils comptent moins. Ils ne rangent rien
// pour autant — un tag filtre, il ne déplace pas.
export function PropertiesDisclosure({ element }: { element: Element }) {
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
    <div className="text-[17px]">
      <div className="mb-3 text-[14px] font-semibold text-ink-3">Tags</div>
      <div className="flex flex-wrap items-center gap-2">
        {tags?.length === 0 && (
          <span className="text-[16px] text-ink-4">
            Aucun tag — ajoute-en un pour retrouver cet Element depuis
            ailleurs.
          </span>
        )}
        {tags?.map((tag) => (
          <Pill
            key={tag.id}
            tone={tag.id}
            className="px-3 py-1.5 pr-2 text-[14.5px] font-medium"
          >
            {tag.name}
            <button
              onClick={() => removeTagMutation.mutate(tag.id)}
              aria-label={`Retirer le tag ${tag.name}`}
              className="cursor-pointer text-ink/45 transition hover:text-ink"
            >
              <X size={14} strokeWidth={2.5} />
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
          className="w-24 border-b border-line bg-transparent px-1 py-1 text-[14.5px] text-ink-2 outline-none transition focus:border-ink"
        />
      </div>
    </div>
  );
}
