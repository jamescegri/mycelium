import { useEffect, useRef, useState } from 'react';
import { searchElements } from '../lib/elements';
import type { Element } from '../types';

export function ElementPicker({
  excludeId,
  placeholder,
  onPick,
}: {
  excludeId: string;
  placeholder: string;
  onPick: (element: Element) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Element[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    searchElements(query, excludeId).then((found) => {
      if (id === requestId.current) setResults(found);
    });
  }, [query, open, excludeId]);

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
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
          {results.map((el) => (
            <button
              key={el.id}
              type="button"
              onMouseDown={() => {
                onPick(el);
                setQuery('');
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
            >
              <span className="truncate">{el.name}</span>
              <span className="ml-2 shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
                {el.family}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
