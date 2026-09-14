import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, X } from 'lucide-react';
import {
  addTagToElement,
  listTagsForElement,
  removeTagFromElement,
} from '../lib/tags';
import { Pill } from './Pill';
import { PropertyEmpty, PropertyRow } from './PropertyRow';
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
    <PropertyRow icon={TagIcon} label="Tags">
      {tags?.length === 0 && <PropertyEmpty>Aucun</PropertyEmpty>}

      {tags?.map((tag) => (
        <Pill
          key={tag.id}
          tone={tag.id}
          className="group py-1 pr-1.5 pl-3 text-[14px] font-medium"
        >
          {tag.name}
          <button
            onClick={() => removeTagMutation.mutate(tag.id)}
            aria-label={`Retirer le tag ${tag.name}`}
            className="hidden cursor-pointer px-0.5 text-ink/45 transition group-hover:inline hover:text-ink"
          >
            <X size={13} strokeWidth={2.5} />
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
        className="w-20 border-b border-line bg-transparent px-1 py-0.5 text-[14px] text-ink-2 outline-none transition focus:border-ink"
      />
    </PropertyRow>
  );
}
