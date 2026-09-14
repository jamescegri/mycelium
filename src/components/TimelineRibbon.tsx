import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listElements } from '../lib/elements';
import { listAllLinks } from '../lib/links';
import { listTemporalRelations } from '../lib/temporal';
import { timelineBands } from '../lib/chronology';
import { displayName } from '../lib/display';
import { pastelFor } from '../lib/palette';
import type { Element, ElementLink } from '../types';

const NO_ELEMENTS: Element[] = [];
const NO_LINKS: ElementLink[] = [];

// Le récit à plat dans le temps. Chaque bande est un niveau — les arcs en
// haut, les scènes en bas — et un bloc couvre exactement la largeur de ce
// qu'il contient. On lit donc le rythme du récit : quel arc s'étire, quel
// chapitre est expédié en deux scènes.
//
// L'unité est la scène, pas le pixel : deux tomes de même largeur pèsent
// le même nombre de scènes, ce qui rend la comparaison honnête.
const SCENE_WIDTH = 92;

export function TimelineRibbon() {
  const navigate = useNavigate();

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const { bands, width } = useMemo(
    () =>
      timelineBands(
        elements ?? NO_ELEMENTS,
        links ?? NO_LINKS,
        relations ?? []
      ),
    [elements, links, relations]
  );

  if (width === 0) {
    return (
      <p className="text-[15px] text-ink-3">
        Rien dans la chronologie pour l'instant.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div
        className="flex flex-col gap-1.5"
        style={{ minWidth: width * SCENE_WIDTH }}
      >
        {bands.map((band, depth) => (
          <div
            key={depth}
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
            }}
          >
            {band.map((block) => {
              const tone = pastelFor(block.element.id);
              return (
                <button
                  key={`${block.element.id}-${block.start}`}
                  onClick={() => navigate(`/elements/${block.element.id}`)}
                  // `start` est en base 0, les colonnes de grille en base 1.
                  style={{
                    gridColumn: `${block.start + 1} / span ${block.span}`,
                    // Les feuilles restent claires et les ensembles pleins :
                    // la profondeur se lit sans compter les bandes.
                    backgroundColor: block.isLeaf ? 'transparent' : tone.bg,
                    boxShadow: block.isLeaf
                      ? `inset 0 0 0 1.5px ${tone.bg}`
                      : undefined,
                    color: 'var(--color-ink)',
                  }}
                  className="overflow-hidden rounded-lg px-2.5 py-2 text-left transition hover:opacity-85"
                >
                  <span
                    className={`block truncate ${
                      depth === 0
                        ? 'text-[14.5px] font-semibold'
                        : block.isLeaf
                          ? 'text-[13px]'
                          : 'text-[13.5px] font-medium'
                    }`}
                  >
                    {displayName(block.element)}
                  </span>
                  {/* Le compte n'a de sens que sur un ensemble : une scène
                      ne contient rien, l'afficher à 1 n'apprendrait rien. */}
                  {!block.isLeaf && block.span > 1 && (
                    <span className="mt-0.5 block text-[11.5px] tabular-nums opacity-60">
                      {block.span} scènes
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
