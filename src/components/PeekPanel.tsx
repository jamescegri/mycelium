import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getElement, listElements } from '../lib/elements';
import { childrenOf, listAllLinks, parentsOf } from '../lib/links';
import { extractPlainText } from '../lib/content';
import { ConnectionsDisclosure } from './ConnectionsDisclosure';
import { displayName } from '../lib/display';
import type { Element } from '../types';

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
  // Le panneau sert à explorer sans quitter sa page : parents ET enfants y
  // sont donc cliquables, et chaque clic reste dans le panneau (onSelect
  // empile, la flèche ← dépile) plutôt que de naviguer.
  const children =
    allElements && links && element
      ? childrenOf(links, allElements, element.id)
      : [];

  return (
    <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-line bg-white p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {!element ? (
          <p className="text-[16px] text-ink-3">Chargement…</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between text-[13.5px] text-ink-3">
              <div className="flex items-center gap-2">
                {hasBack && (
                  <button onClick={onBack} className="hover:text-ink">
                    ←
                  </button>
                )}
                <span>{element.timeline ? 'Chronologie' : ''}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onOpenFull(element.id)}
                  className="hover:text-ink"
                >
                  Ouvrir en pleine page ↗
                </button>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="text-base leading-none text-ink-2 hover:text-ink"
                >
                  ×
                </button>
              </div>
            </div>

            <h2 className="mb-3 text-[28px] font-semibold text-ink">
              {displayName(element)}
            </h2>

            {!!element.content && (
              <p className="mb-6 text-[16px] leading-relaxed text-ink-2">
                {extractPlainText(element.content)}
              </p>
            )}

            <NavGroup
              label="Parents"
              items={parents}
              tone="var(--color-fluo-parent)"
              onSelect={onSelect}
            />
            <NavGroup
              label="Enfants"
              items={children}
              tone="var(--color-fluo-child)"
              onSelect={onSelect}
            />

            <div className="mt-6 border-t border-line pt-5">
              <ConnectionsDisclosure elementId={element.id} onSelect={onSelect} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Parents et enfants du panneau : chaque nom rouvre le panneau sur cet
// Element, d'où la pile et la flèche retour. La pastille reprend la couleur
// du déclencheur correspondant ("@" pour un parent, "+" pour un enfant).
function NavGroup({
  label,
  items,
  tone,
  onSelect,
}: {
  label: string;
  items: Element[];
  tone: string;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="mb-2 text-[13px] font-semibold text-ink-3">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((el) => (
          <button
            key={el.id}
            onClick={() => onSelect(el.id)}
            style={{ backgroundColor: tone }}
            className="max-w-full truncate rounded-full px-3 py-1.5 text-[14.5px] font-medium text-ink transition hover:brightness-95"
          >
            {displayName(el)}
          </button>
        ))}
      </div>
    </div>
  );
}
