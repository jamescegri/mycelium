import { useEffect, useRef, useState } from 'react';
import { createElement, searchElements } from '../lib/elements';
import type { Element, ElementFamily } from '../types';

export function ElementPicker({
  excludeIds,
  placeholder,
  onPick,
  allowCreate = true,
  createFamily = 'ELEMENTS',
  createParentId = null,
}: {
  excludeIds: string[];
  placeholder: string;
  onPick: (element: Element) => void;
  allowCreate?: boolean;
  createFamily?: ElementFamily;
  createParentId?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Element[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const requestId = useRef(0);
  const excludeKey = excludeIds.join(',');

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    searchElements(query, excludeKey ? excludeKey.split(',') : []).then(
      (found) => {
        if (id === requestId.current) setResults(found);
      }
    );
  }, [query, open, excludeKey]);

  const trimmed = query.trim();
  const hasExactMatch = results.some(
    (r) => r.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreate = allowCreate && trimmed.length > 0 && !hasExactMatch;

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await createElement({
        name: trimmed,
        family: createFamily,
        parentId: createParentId,
      });
      onPick(created);
      setQuery('');
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative flex-1">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
      />
      {open && (results.length > 0 || showCreate) && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-300 bg-neutral-50 py-1 shadow-xl">
          {results.map((el) => (
            <button
              key={el.id}
              type="button"
              onMouseDown={() => {
                onPick(el);
                setQuery('');
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100"
            >
              <span className="truncate">{el.name}</span>
              <span className="ml-2 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                {el.family}
              </span>
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={handleCreate}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
            >
              <span className="text-yellow-500">+ Créer</span>
              <span className="truncate">{trimmed}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
