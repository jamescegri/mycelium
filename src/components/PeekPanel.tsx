import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getElement, listElements } from '../lib/elements';
import { listAllLinks, parentsOf } from '../lib/links';
import { extractPlainText } from '../lib/content';
import { ConnectionsDisclosure } from './ConnectionsDisclosure';

interface PeekContextValue {
  openPeek: (id: string) => void;
  pushPeek: (id: string) => void;
}

const PeekContext = createContext<PeekContextValue | null>(null);

export function usePeek() {
  const ctx = useContext(PeekContext);
  if (!ctx) throw new Error('usePeek doit être utilisé dans PeekProvider');
  return ctx;
}

// Cliquer une connexion, une mention ou un backlink ouvre l'Element visé
// dans ce panneau plutôt que de naviguer : la page en cours (et son
// scroll) reste montée derrière, intacte. Une pile (pas un simple id)
// permet de rebondir de connexion en connexion depuis le panneau lui-même
// sans perdre le fil jusqu'à la page de départ.
export function PeekProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<string[]>([]);
  const navigate = useNavigate();

  function openPeek(id: string) {
    setStack([id]);
  }
  function pushPeek(id: string) {
    setStack((s) => [...s, id]);
  }
  function popPeek() {
    setStack((s) => s.slice(0, -1));
  }
  function closePeek() {
    setStack([]);
  }

  return (
    <PeekContext.Provider value={{ openPeek, pushPeek }}>
      {children}
      {stack.length > 0 && (
        <PeekOverlay
          currentId={stack[stack.length - 1]}
          hasBack={stack.length > 1}
          onBack={popPeek}
          onClose={closePeek}
          onSelect={pushPeek}
          onOpenFull={(id) => {
            closePeek();
            navigate(`/elements/${id}`);
          }}
        />
      )}
    </PeekContext.Provider>
  );
}

function PeekOverlay({
  currentId,
  hasBack,
  onBack,
  onClose,
  onSelect,
  onOpenFull,
}: {
  currentId: string;
  hasBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenFull: (id: string) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { data: element } = useQuery({
    queryKey: ['elements', currentId],
    queryFn: () => getElement(currentId),
  });
  const { data: allElements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({
    queryKey: ['links'],
    queryFn: listAllLinks,
  });
  const parents =
    allElements && links && element
      ? parentsOf(links, allElements, element.id)
      : [];

  return (
    <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-neutral-200 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!element ? (
          <p className="text-sm text-neutral-500">Chargement…</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                {hasBack && (
                  <button onClick={onBack} className="hover:text-neutral-700">
                    ←
                  </button>
                )}
                <span>{element.family}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onOpenFull(element.id)}
                  className="hover:text-neutral-700"
                >
                  Ouvrir en pleine page ↗
                </button>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="text-base leading-none text-neutral-600 hover:text-neutral-800"
                >
                  ×
                </button>
              </div>
            </div>

            {parents.length > 0 && (
              <div className="mb-1 truncate text-xs text-neutral-400">
                {parents.map((p) => p.name).join(' · ')}
              </div>
            )}

            <h2 className="mb-3 text-xl font-semibold text-neutral-900">
              {element.name || 'Sans titre'}
            </h2>

            {!!element.content && (
              <p className="mb-4 text-sm leading-relaxed text-neutral-600">
                {extractPlainText(element.content)}
              </p>
            )}

            <ConnectionsDisclosure elementId={element.id} onSelect={onSelect} />
          </>
        )}
      </div>
    </div>
  );
}
