import { forwardRef, useImperativeHandle, useState } from 'react';

export interface MentionItem {
  id: string;
  name: string;
  isCreate?: boolean;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [prevItems, setPrevItems] = useState(items);
    if (items !== prevItems) {
      setPrevItems(items);
      setSelectedIndex(0);
    }

    function selectItem(index: number) {
      const item = items[index];
      if (item) command(item);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="w-64 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 shadow-xl">
          Tape pour chercher un Element…
        </div>
      );
    }

    return (
      <div className="max-h-64 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 py-1 shadow-xl">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm ${
              index === selectedIndex
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-700 hover:bg-neutral-100/60'
            }`}
          >
            {item.isCreate && (
              <span className="text-yellow-500">+ Créer</span>
            )}
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
    );
  }
);
MentionList.displayName = 'MentionList';
