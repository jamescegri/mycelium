import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { childrenOf, hasChildren, rootElements } from '../lib/links';
import type { Element, ElementLink } from '../types';

export interface MentionItem {
  id: string;
  name: string;
  isCreate?: boolean;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  query: string;
  // Données pour le parcours des Groupes quand la recherche est vide —
  // optionnel : sans elles, le popup reste une simple liste de résultats.
  browse?: { elements: Element[]; links: ElementLink[] };
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command, query, browse }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [browseStack, setBrowseStack] = useState<string[]>([]);

    const isBrowsing = query.trim().length === 0 && !!browse;
    const currentGroupId = browseStack[browseStack.length - 1] ?? null;

    const browseItems: MentionItem[] = isBrowsing
      ? (currentGroupId
          ? childrenOf(browse!.links, browse!.elements, currentGroupId)
          : rootElements(browse!.links, browse!.elements)
        ).map((e) => ({ id: e.id, name: e.name || 'Sans titre' }))
      : [];
    const displayItems = isBrowsing ? browseItems : items;

    // displayItems est recalculé (nouvelle référence) à chaque rendu — on
    // ne peut pas comparer par identité. On ne réinitialise la sélection
    // que quand ce qui détermine vraiment la liste change (la recherche
    // tapée, ou le Groupe actuellement parcouru).
    useEffect(() => {
      setSelectedIndex(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, currentGroupId]);

    function selectItem(index: number) {
      const item = displayItems[index];
      if (item) command(item);
    }

    function drillInto(id: string) {
      setBrowseStack((s) => [...s, id]);
      setSelectedIndex(0);
    }
    function goBack() {
      setBrowseStack((s) => s.slice(0, -1));
      setSelectedIndex(0);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex(
            (i) => (i + displayItems.length - 1) % displayItems.length
          );
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % displayItems.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        if (event.key === 'Backspace' && isBrowsing && browseStack.length > 0) {
          goBack();
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="max-h-72 w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 py-1 shadow-xl">
        {isBrowsing && browseStack.length > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="flex w-full items-center gap-1.5 border-b border-neutral-200 px-3 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-100/60"
          >
            ← Retour
          </button>
        )}
        {displayItems.length === 0 ? (
          <div className="px-3 py-2 text-sm text-neutral-500">
            {isBrowsing ? 'Aucun Element ici.' : 'Tape pour chercher un Element…'}
          </div>
        ) : (
          displayItems.map((item, index) => {
            const canDrillInto =
              isBrowsing && browse && hasChildren(browse.links, item.id);
            return (
              <div
                key={item.id}
                className={`flex w-full items-center gap-1.5 px-1 ${
                  index === selectedIndex
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-100/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectItem(index)}
                  className="flex flex-1 items-center gap-1.5 px-2 py-2 text-left text-sm"
                >
                  {item.isCreate && (
                    <span className="text-yellow-500">+ Créer</span>
                  )}
                  <span className="truncate">{item.name}</span>
                </button>
                {canDrillInto && (
                  <button
                    type="button"
                    onClick={() => drillInto(item.id)}
                    aria-label={`Voir les enfants de ${item.name}`}
                    className="shrink-0 px-2 py-2 text-neutral-400 hover:text-neutral-700"
                  >
                    ›
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }
);
MentionList.displayName = 'MentionList';
