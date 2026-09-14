import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { childrenOf, hasChildren, rootElements } from '../lib/links';
import type { Element, ElementLink } from '../types';
import { displayName } from '../lib/display';

export interface MentionItem {
  id: string;
  name: string;
  isCreate?: boolean;
}

// Le caractère qui a ouvert le popup. Il décide de la couleur de l'en-tête
// et du libellé : on sait donc, avant même de choisir, si on est en train
// d'écrire une mention, de se rattacher à un parent ou d'ajouter un enfant.
export type TriggerChar = '/' | '@' | '+';

const TRIGGER: Record<TriggerChar, { label: string; bg: string }> = {
  '/': { label: 'Mentionner dans le texte', bg: 'var(--color-fluo-mention)' },
  '@': { label: 'Rattacher à un parent', bg: 'var(--color-fluo-parent)' },
  '+': { label: 'Ajouter un enfant', bg: 'var(--color-fluo-child)' },
};

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  query: string;
  trigger?: TriggerChar;
  // Données pour le parcours des Groupes quand la recherche est vide —
  // optionnel : sans elles, le popup reste une simple liste de résultats.
  browse?: { elements: Element[]; links: ElementLink[] };
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command, query, browse, trigger }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [browseStack, setBrowseStack] = useState<string[]>([]);

    const isBrowsing = query.trim().length === 0 && !!browse;
    const currentGroupId = browseStack[browseStack.length - 1] ?? null;

    const browseItems: MentionItem[] = isBrowsing
      ? (currentGroupId
          ? childrenOf(browse!.links, browse!.elements, currentGroupId)
          : rootElements(browse!.links, browse!.elements)
        ).map((e) => ({ id: e.id, name: displayName(e) }))
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
      <div className="max-h-80 w-80 overflow-y-auto rounded-xl border-2 border-ink bg-surface shadow-[0_18px_44px_-16px_rgba(0,0,0,0.45)]">
        {trigger && (
          <div
            className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold text-ink"
            style={{ backgroundColor: TRIGGER[trigger].bg }}
          >
            <span className="font-bold">{trigger}</span>
            {TRIGGER[trigger].label}
          </div>
        )}
        {isBrowsing && browseStack.length > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="flex w-full items-center gap-1.5 border-b border-line px-3.5 py-2 text-left text-[13.5px] font-medium text-ink-3 hover:bg-surface-2"
          >
            ← Retour
          </button>
        )}
        {displayItems.length === 0 ? (
          <div className="px-3.5 py-2.5 text-[15px] text-ink-3">
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
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-2 hover:bg-surface-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectItem(index)}
                  className="flex flex-1 items-center gap-1.5 px-2.5 py-2.5 text-left text-[15px]"
                >
                  {item.isCreate && (
                    <span className="font-semibold text-ink">+ Créer</span>
                  )}
                  <span className="truncate">{item.name}</span>
                </button>
                {canDrillInto && (
                  <button
                    type="button"
                    onClick={() => drillInto(item.id)}
                    aria-label={`Voir les enfants de ${item.name}`}
                    className="shrink-0 px-2.5 py-2.5 text-[16px] text-ink-4 hover:text-ink"
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
