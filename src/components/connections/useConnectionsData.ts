import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listElements } from '../../lib/elements';
import { listAllLinks } from '../../lib/links';
import { listAllRelations } from '../../lib/relations';
import { listAllElementTags, listAllTags } from '../../lib/tags';
import { listTemporalRelations } from '../../lib/temporal';
import { timelineRows } from '../../lib/chronology';
import { buildConnectionsIndex } from '../../lib/connections';
import type { Element, ElementLink, Relation, Tag, TemporalRelation } from '../../types';

const NO_ELEMENTS: Element[] = [];
const NO_LINKS: ElementLink[] = [];
const NO_RELATIONS: Relation[] = [];
const NO_TAGS: Tag[] = [];
const NO_ELEMENT_TAGS: { element_id: string; tag_id: string }[] = [];
const NO_TEMPORAL: TemporalRelation[] = [];

// Les données de l'univers et leur index, préparés une fois par changement
// de données. Partagé par Connexions et Fils : les deux lisent les mêmes
// Elements, liens et mentions, et doivent en avoir la même lecture.
export function useConnectionsData() {
  const { data: elements, isLoading } = useQuery({ queryKey: ['elements'], queryFn: listElements });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: relations } = useQuery({ queryKey: ['relations'], queryFn: listAllRelations });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listAllTags });
  const { data: elementTags } = useQuery({ queryKey: ['element-tags'], queryFn: listAllElementTags });
  const { data: temporal } = useQuery({ queryKey: ['temporal-relations'], queryFn: listTemporalRelations });

  const all = elements ?? NO_ELEMENTS;
  const allLinks = links ?? NO_LINKS;
  const allRelations = relations ?? NO_RELATIONS;
  const allTags = tags ?? NO_TAGS;
  const allElementTags = elementTags ?? NO_ELEMENT_TAGS;
  const allTemporal = temporal ?? NO_TEMPORAL;

  const index = useMemo(() => {
    const chronology = new Set(timelineRows(all, allLinks, allTemporal).map((row) => row.element.id));
    return buildConnectionsIndex({
      elements: all,
      links: allLinks,
      relations: allRelations,
      tagNames: new Map(allTags.map((t) => [t.id, t.name])),
      elementTags: allElementTags,
      chronology,
    });
  }, [all, allLinks, allRelations, allTags, allElementTags, allTemporal]);

  return {
    index,
    elements: all,
    relations: allRelations,
    tags: allTags,
    elementTags: allElementTags,
    temporal: allTemporal,
    isLoading,
  };
}
