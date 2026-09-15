import { useMemo, useState } from 'react';
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
  // Figé à l'ouverture : les « il y a 5 min » ne doivent pas bouger sous
  // les yeux pendant qu'on lit.
  const [now] = useState(() => Date.now());

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

  // Les notes qu'aucun Groupe ne contient : elles se perdent, et c'est la
  // dette d'écriture la plus fréquente. Autant la montrer là où l'on
  // revient tous les jours — et pas sous forme de groupe "Idées", qui
  // imposerait une catégorie et qu'il faudrait ensuite défaire.
  const unfiled = useMemo(
    () =>
      all.filter((e) => parentsOf(allLinks, all, e.id).length === 0).length,
    [all, allLinks]
  );

  return (
    <div className="mx-auto max-w-[64rem] px-6 py-16 max-md:px-4 max-md:py-8 sm:px-14">
      {/* Le champ garde une largeur de phrase même quand la page s'élargit
          pour la galerie : un champ de 900 px intimide plus qu'il n'invite. */}
      <div className="max-w-[46rem]">
        {/* Sur téléphone, le champ doit être atteignable sans défiler : le
            titre se resserre pour lui laisser le haut de l'écran. */}
        <h1 className="title-display mb-2 text-[40px] max-md:text-[28px]">
          Continue ton histoire
        </h1>
        <p className="mb-8 text-[16.5px] text-ink-3 max-md:mb-5 max-md:text-[15px]">
          Note une idée maintenant, tu la rangeras plus tard.
        </p>

        <CaptureBar />
      </div>

      {/* Reprendre vient juste sous l'écriture : c'est l'autre moitié du
          même geste, se remettre au travail. En galerie, parce qu'on
          reconnaît une scène à son début de texte plus vite qu'à son titre. */}
      {recent.length > 0 && (
        <section className="mt-14">
          <SectionTitle>Reprendre</SectionTitle>
          <div className="stagger grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
            {recent.map((el) => (
              <RecentCard
                key={el.id}
                element={el}
                parent={parentsOf(allLinks, all, el.id)[0] ?? null}
                isGroup={hasChildren(allLinks, el.id)}
                now={now}
                onOpen={() => navigate(`/elements/${el.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {entries.length > 0 && (
        <section className="mt-14">
          <SectionTitle>Tes entrées</SectionTitle>
          <div className="stagger flex flex-wrap gap-2.5">
            {entries.map((entry) => {
              const tone = pastelFor(entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/elements/${entry.id}`)}
                  className="lift rounded-full px-4 py-2 text-[14.5px] font-medium"
                  style={{ backgroundColor: tone.bg, color: tone.text }}
                >
                  {displayName(entry)}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {unfiled > 0 && (
        <button
          onClick={() => navigate('/groupes')}
          className="group mt-12 flex items-center gap-2 text-[15px] text-ink-3 transition hover:text-ink"
        >
          {unfiled} Element{unfiled > 1 ? 's' : ''} n'
          {unfiled > 1 ? 'ont' : 'a'} pas encore trouvé sa place
          <ArrowRight
            size={15}
            strokeWidth={2}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </button>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="mb-4 text-[12px] font-semibold tracking-[0.08em] text-ink-4 uppercase">
      {children}
    </p>
  );
}

// « Il y a 3 h » plutôt qu'une date : pour reprendre, ce qui compte est
// la distance au dernier passage, pas le jour exact.
function since(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function RecentCard({
  element,
  parent,
  isGroup,
  now,
  onOpen,
}: {
  element: Element;
  parent: Element | null;
  isGroup: boolean;
  now: number;
  onOpen: () => void;
}) {
  const excerpt = extractPlainText(element.content, 140);
  const untitled = isUntitled(element);
  const tone = pastelFor(element.id);

  return (
    <button
      onClick={onOpen}
      className="lift flex min-h-[9.5rem] flex-col gap-2.5 rounded-2xl border border-line bg-surface p-5 text-left hover:border-ink-4"
    >
      <span className="flex items-center gap-2.5">
        {/* Pleine pour un Groupe, creuse pour une feuille : la même règle
            que dans l'explorateur. */}
        <span
          className="size-3 shrink-0 rounded-[4px]"
          style={
            isGroup
              ? { backgroundColor: tone.bg }
              : { boxShadow: `inset 0 0 0 2px ${tone.bg}` }
          }
        />
        <span
          className={`truncate text-[16px] font-semibold ${
            untitled ? 'text-ink-3 italic' : ''
          }`}
        >
          {displayName(element)}
        </span>
      </span>

      {excerpt && !untitled && (
        <span className="line-clamp-3 text-[14px] leading-relaxed text-ink-3">
          {excerpt}
        </span>
      )}

      <span className="mt-auto flex items-center gap-2 pt-1 text-[12.5px] text-ink-4">
        {parent && <span className="truncate">{displayName(parent)}</span>}
        {parent && <span aria-hidden>·</span>}
        <span className="shrink-0">{since(element.updated_at, now)}</span>
      </span>
    </button>
  );
}
