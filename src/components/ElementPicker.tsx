import { useEffect, useRef, useState } from 'react';
import { createElement, searchElements } from '../lib/elements';
import type { Element } from '../types';

export function ElementPicker({
  excludeIds,
  placeholder,
  onPick,
  allowCreate = true,
}: {
  excludeIds: string[];
  placeholder: string;
  onPick: (element: Element) => void;
  allowCreate?: boolean;
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
      const created = await createElement({ name: trimmed });
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
        className="w-full rounded-lg border border-transparent bg-transparent px-2.5 py-2 text-[16px] text-ink-2 outline-none transition placeholder:text-ink-4 hover:bg-surface-2 focus:border-line focus:bg-surface"
      />
      {open && (results.length > 0 || showCreate) && (
        <div className="absolute z-10 mt-1 max-h-64 w-full min-w-[260px] overflow-y-auto rounded-xl border-2 border-ink bg-surface py-1 shadow-[0_18px_44px_-16px_rgba(0,0,0,0.45)]">
          {results.map((el) => (
            <button
              key={el.id}
              type="button"
              onMouseDown={() => {
                onPick(el);
                setQuery('');
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[15px] text-ink-2 transition hover:bg-surface-2 hover:text-ink"
            >
              <span className="truncate">{el.name}</span>
              {el.timeline && (
                <span className="ml-2 shrink-0 text-[12px] text-ink-4">
                  Chronologie
                </span>
              )}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={handleCreate}
              className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-[15px] text-ink-2 transition hover:bg-surface-2 disabled:opacity-50"
            >
              <span className="font-semibold text-ink">+ Créer</span>
              <span className="truncate">{trimmed}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
