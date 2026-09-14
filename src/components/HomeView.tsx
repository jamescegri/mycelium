import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { listElements } from '../lib/elements';
import { hasChildren, listAllLinks, parentsOf } from '../lib/links';
import { extractPlainText } from '../lib/content';
import { displayName, isUntitled } from '../lib/display';
import { pastelFor } from '../lib/palette';
import { CaptureBar } from './CaptureBar';
import type { Element, ElementLink } from '../types';

// Constantes de repli stables : `?? []` fabrique un tableau neuf à chaque
// rendu, ce qui invalide tous les useMemo qui en dépendent.
const NO_ELEMENTS: Element[] = [];
const NO_LINKS: ElementLink[] = [];

// L'accueil ne récapitule pas l'univers : il sert à s'y remettre. Deux
// gestes seulement — jeter une idée qui vient d'arriver, ou reprendre ce
// qu'on écrivait hier. Le reste se trouve dans les onglets, qui sont faits
// pour ça.
export function HomeView() {
  const navigate = useNavigate();

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });

  const all = elements ?? NO_ELEMENTS;
  const allLinks = links ?? NO_LINKS;

  const recent = useMemo(
    () =>
      [...all]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 6),
    [all]
  );

  // Les grandes entrées : les Groupes qui ne sont rangés nulle part. Ce
  // sont les portes de l'univers, celles par lesquelles on rentre.
  const entries = useMemo(
    () =>
      all.filter(
        (e) =>
          hasChildren(allLinks, e.id) &&
          parentsOf(allLinks, all, e.id).length === 0
      ),
    [all, allLinks]
  );

  // Les captures jamais nommées : c'est la dette d'écriture la plus
  // fréquente, autant la montrer là où on revient tous les jours.
  const unnamed = useMemo(() => all.filter(isUntitled).length, [all]);

  return (
    <div className="mx-auto max-w-[46rem] px-6 py-14 max-md:px-4 max-md:py-7 sm:px-10">
      {/* Sur téléphone, le champ doit être atteignable sans défiler : le
          titre se resserre pour lui laisser le haut de l'écran. */}
      <h1 className="title-display mb-1.5 text-[38px] max-md:text-[26px]">
        Qu'est-ce qui arrive ?
      </h1>
      <p className="mb-7 text-[16.5px] text-ink-3 max-md:mb-5 max-md:text-[15px]">
        Écris-le maintenant, tu le rangeras plus tard.
      </p>

      <CaptureBar />

      {entries.length > 0 && (
        <section className="mt-14">
          <SectionTitle>Tes entrées</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {entries.map((entry) => {
              const tone = pastelFor(entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/elements/${entry.id}`)}
                  className="rounded-full px-3.5 py-1.5 text-[14.5px] font-medium transition hover:opacity-80"
                  style={{ backgroundColor: tone.bg, color: tone.text }}
                >
                  {displayName(entry)}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-12">
          <SectionTitle>Reprendre</SectionTitle>
          <div className="flex flex-col">
            {recent.map((el) => (
              <RecentRow
                key={el.id}
                element={el}
                onOpen={() => navigate(`/elements/${el.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {unnamed > 0 && (
        <button
          onClick={() => navigate('/liste')}
          className="mt-10 flex items-center gap-2 text-[15px] text-ink-3 transition hover:text-ink"
        >
          {unnamed} Element{unnamed > 1 ? 's' : ''} attend
          {unnamed > 1 ? 'ent' : ''} encore un titre
          <ArrowRight size={15} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[12px] font-semibold tracking-[0.08em] text-ink-4 uppercase">
      {children}
    </p>
  );
}

function RecentRow({
  element,
  onOpen,
}: {
  element: Element;
  onOpen: () => void;
}) {
  const excerpt = extractPlainText(element.content, 70);
  const untitled = isUntitled(element);

  return (
    <button
      onClick={onOpen}
      className="flex items-baseline gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-surface-2"
    >
      <span
        className={`shrink-0 text-[16.5px] ${untitled ? 'text-ink-3 italic' : ''}`}
      >
        {displayName(element)}
      </span>
      {excerpt && !untitled && (
        <span className="min-w-0 flex-1 truncate text-[14px] text-ink-4">
          {excerpt}
        </span>
      )}
    </button>
  );
}
