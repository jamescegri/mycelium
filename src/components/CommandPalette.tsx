import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createElement, listElements } from '../lib/elements';
import { linkChild, listAllLinks, parentsOf } from '../lib/links';
import { usePeek } from './PeekPanel';
import type { Element } from '../types';

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      'useCommandPalette doit être utilisé dans CommandPaletteProvider'
    );
  }
  return ctx;
}

// Recherche rapide accessible de partout (Cmd/Ctrl+K, ou le bouton
// "Rechercher" du header). Sert aussi de moyen principal d'exploration : on
// tape un nom, on navigue ou on jette un œil (aperçu), et si l'Element
// n'existe pas encore on le crée sans jamais quitter ce qu'on était en train
// de faire.
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      {isOpen && <CommandPaletteOverlay onClose={() => setIsOpen(false)} />}
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { openPeek } = usePeek();
  const queryClient = useQueryClient();
  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({
    queryKey: ['links'],
    queryFn: listAllLinks,
  });

  const all = elements ?? [];
  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? all.filter((e) => e.name.toLowerCase().includes(trimmed))
    : all.slice(0, 8);
  const hasExact = matches.some((e) => e.name.toLowerCase() === trimmed);

  // Créer depuis la palette place le nouvel Element là où c'est le plus
  // probable : en enfant de la page Element courante (si on est sur une
  // page Element), sinon à la racine.
  const elementMatch = location.pathname.match(/^\/elements\/([^/]+)/);
  const currentElement = elementMatch
    ? all.find((e) => e.id === elementMatch[1])
    : undefined;

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const created = await createElement({
        name,
        family: currentElement?.family ?? 'ELEMENTS',
      });
      if (currentElement) {
        await linkChild(currentElement.id, created.id);
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['links'] });
      onClose();
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  function pathOf(el: Element) {
    if (!links) return '';
    return parentsOf(links, all, el.id)
      .map((p) => p.name)
      .join(' · ');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-surface-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher ou créer un Element…"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] text-ink outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-1.5">
          {matches.map((el) => (
            <div
              key={el.id}
              className="flex items-center justify-between rounded px-2.5 py-2 hover:bg-surface-3"
            >
              <button
                onClick={() => {
                  onClose();
                  navigate(`/elements/${el.id}`);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-[16px] text-ink">
                  {el.name || 'Sans titre'}
                </div>
                <div className="truncate text-[13.5px] text-ink-4">
                  {pathOf(el) || el.family}
                </div>
              </button>
              <button
                onClick={() => {
                  onClose();
                  openPeek(el.id);
                }}
                aria-label={`Aperçu de ${el.name}`}
                className="ml-2 shrink-0 text-ink-4 hover:text-ink"
              >
                ⇢
              </button>
            </div>
          ))}
          {trimmed && !hasExact && (
            <button
              onClick={() => createMutation.mutate(query.trim())}
              disabled={createMutation.isPending}
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[16px] hover:bg-surface-3 disabled:opacity-50"
            >
              <span className="text-accent">+ Créer</span>
              <span className="truncate text-ink-2">{query.trim()}</span>
            </button>
          )}
          {!trimmed && matches.length === 0 && (
            <p className="px-2.5 py-4 text-center text-[13.5px] text-ink-4">
              Tape pour chercher…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
