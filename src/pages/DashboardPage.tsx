import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Columns3, Download, FileText, Rows3 } from 'lucide-react';
import { listElements } from '../lib/elements';
import { listAllLinks, parentsOf } from '../lib/links';
import { listAllElementTags, listAllTags } from '../lib/tags';
import { displayName, isUntitled } from '../lib/display';
import { searchFullText } from '../lib/search';
import { downloadMarkdown, universeToMarkdown } from '../lib/export';
import { TimelineTree } from '../components/TimelineTree';
import { ConnectionsView } from '../components/connections/ConnectionsView';
import { TimelineRibbon } from '../components/TimelineRibbon';
import type { Element, ElementLink } from '../types';

// Les angles sont de vraies routes, pas un état local : le bouton Retour
// du navigateur fonctionne, et une vue peut être mise en favori. Ils sont
// atteints depuis le rail — voir Layout.
//
// Aucune vue n'introduit de donnée propre : tout est dérivé de ce qui
// existe déjà (element_links, relations, temporal_relations). Un Groupe
// n'est rien d'autre qu'un Element qui a au moins un enfant.
export function DashboardPage() {
  const location = useLocation();
  const path = location.pathname;
  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({
    queryKey: ['links'],
    queryFn: listAllLinks,
  });

  // Connexions a sa propre page : un Element au centre, ses voisins en
  // visuel, et l'exploration de voisin en voisin — voir ConnectionsView.
  if (path === '/connexions') return <ConnectionsView />;

  const title =
    path === '/liste' ? 'Tous les Elements'
    : path === '/temporel' ? 'Chronologie'
    : 'Connexions';

  const sub =
    path === '/liste'
      ? "Tout ce que tu as écrit, à plat. L'endroit où l'on est sûr de retrouver ce qu'on ne sait plus où ranger."
      : path === '/temporel'
        ? 'Les Elements que tu as situés dans le temps, dans leur ordre.'
        : 'Ce qui relie tes Elements, cherchable et filtrable.';

  return (
    <div className="mx-auto max-w-[58rem] px-6 py-14 max-md:py-8 sm:px-14">
      <h1 className="title-display mb-2 text-[32px] text-ink">{title}</h1>
      <p className="mb-10 max-w-[62ch] text-[15px] text-ink-3">{sub}</p>

      {path === '/liste' && (
        <ElementsTab elements={elements ?? []} links={links ?? []} />
      )}
      {path === '/temporel' && <TemporalViews />}
    </div>
  );
}

// Deux façons de regarder la même chronologie. En hauteur pour écrire et
// réorganiser — c'est là qu'on ajoute et qu'on déplace. En largeur pour
// prendre du recul : on y lit le rythme du récit, quel arc s'étire et quel
// chapitre est expédié, ce qu'une liste verticale ne montre jamais.
function TemporalViews() {
  const [horizontal, setHorizontal] = useState(false);

  return (
    <div>
      <div className="mb-6 flex w-fit items-center gap-0.5 rounded-xl border border-line p-1">
        {[
          { id: false, label: 'En hauteur', icon: Rows3 },
          { id: true, label: 'En largeur', icon: Columns3 },
        ].map((v) => (
          <button
            key={String(v.id)}
            onClick={() => setHorizontal(v.id)}
            aria-pressed={horizontal === v.id}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] transition ${
              horizontal === v.id
                ? 'bg-accent font-semibold text-white'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <v.icon size={14} strokeWidth={2} />
            {v.label}
          </button>
        ))}
      </div>

      {horizontal ? <TimelineRibbon /> : <TimelineTree />}
    </div>
  );
}

// Une ligne d'Element : du texte, une icône, rien d'autre. Un Element non
// titré s'affiche par ses premiers mots, en retrait, pour qu'on repère d'un
// coup d'œil ce qui reste à nommer.
function ElementRow({
  element,
  excerpt,
  onNavigate,
}: {
  element: Element;
  excerpt?: string | null;
  onNavigate: () => void;
}) {
  const untitled = isUntitled(element);
  return (
    <button
      onClick={onNavigate}
      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-surface-2"
    >
      {element.timeline ? (
        <Clock size={15} strokeWidth={2} className="mt-1 shrink-0 text-ink-4" />
      ) : (
        <FileText size={15} strokeWidth={2} className="mt-1 shrink-0 text-ink-4" />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15.5px] ${
            untitled ? 'text-ink-3 italic' : 'text-ink'
          }`}
        >
          {displayName(element)}
        </span>
        {/* Le passage trouvé : sans lui, un résultat dont le titre ne
            contient pas le mot cherché paraît arriver là par erreur. */}
        {excerpt && (
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
            {excerpt}
          </span>
        )}
      </span>
    </button>
  );
}

// Tous les Elements, à plat. C'est le filet de sécurité : à mille Elements,
// il faut un endroit où l'on est certain que tout est listé, sans avoir à
// deviner dans quel Groupe on a rangé quoi.
function ElementsTab({
  elements,
  links,
}: {
  elements: Element[];
  links: ElementLink[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // La recherche regarde le texte autant que les titres — voir lib/search.
  const hits = useMemo(
    () =>
      query.trim()
        ? searchFullText(elements, query)
        : elements.map((element) => ({ element, inName: true, excerpt: null })),
    [elements, query]
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Chercher un nom, une phrase…"
        className="mb-6 w-full border-b border-line bg-transparent pb-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink-4"
      />

      {elements.length > 0 && (
        <div className="mb-6">
          <ExportButton elements={elements} links={links} />
        </div>
      )}

      {hits.length === 0 ? (
        <p className="text-[15px] text-ink-3">
          {elements.length === 0
            ? "Rien encore. Écris une première idée depuis l'accueil."
            : 'Aucun Element ne correspond.'}
        </p>
      ) : (
        <div className="space-y-0.5">
          {hits.map(({ element: el, excerpt }) => {
            const parents = parentsOf(links, elements, el.id);
            return (
              <div key={el.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <ElementRow
                    element={el}
                    excerpt={excerpt}
                    onNavigate={() => navigate(`/elements/${el.id}`)}
                  />
                </div>
                {parents.length > 0 && (
                  <span className="hidden shrink-0 text-[13px] text-ink-3 sm:block">
                    {displayName(parents[0])}
                    {parents.length > 1 && ` +${parents.length - 1}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sortir tout l'univers en un fichier. Un auteur ne devrait jamais avoir à
// se demander ce qu'il advient de ses notes si l'app disparaît — et relire
// son récit d'une traite, ailleurs, est un usage en soi.
function ExportButton({
  elements,
  links,
}: {
  elements: Element[];
  links: ElementLink[];
}) {
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listAllTags });
  const { data: elementTags } = useQuery({
    queryKey: ['element-tags'],
    queryFn: listAllElementTags,
  });

  return (
    <button
      onClick={() => {
        const markdown = universeToMarkdown(
          elements,
          links,
          tags ?? [],
          elementTags ?? []
        );
        const day = new Date().toISOString().slice(0, 10);
        downloadMarkdown(markdown, `mycelium-${day}.md`);
      }}
      className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13.5px] text-ink-2 transition hover:border-ink hover:text-ink"
    >
      <Download size={14} strokeWidth={2} />
      Exporter en Markdown
    </button>
  );
}
