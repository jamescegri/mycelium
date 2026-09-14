import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, FileText } from 'lucide-react';
import { listElements } from '../lib/elements';
import { getDescendantIds, hasChildren, listAllLinks, parentsOf } from '../lib/links';
import { listAllRelations } from '../lib/relations';
import { listAllElementTags, listAllTags } from '../lib/tags';
import { usePeek } from '../components/PeekPanel';
import { displayName, isUntitled } from '../lib/display';
import { searchElements } from '../lib/search';
import { TimelineTree } from '../components/TimelineTree';
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
    <div className="mx-auto max-w-[56rem] px-6 py-9 sm:px-10">
      <h1 className="title-display mb-1.5 text-[32px] text-ink">{title}</h1>
      <p className="mb-7 max-w-[62ch] text-[15px] text-ink-3">{sub}</p>

      {path === '/liste' && (
        <ElementsTab elements={elements ?? []} links={links ?? []} />
      )}
      {path === '/temporel' && <TimelineTree />}
      {path === '/connexions' && (
        <ConnexionsTab elements={elements ?? []} links={links ?? []} />
      )}
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
        ? searchElements(elements, query)
        : elements.map((element) => ({ element, inName: true, excerpt: null })),
    [elements, query]
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Chercher un nom, une phrase…"
        className="mb-6 w-full border-b border-line bg-transparent pb-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink"
      />

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

// Explorer les liens sans graphe : on combine des critères pour réduire
// progressivement la liste. Chaque filtre répond à une question différente
// — la hiérarchie dit l'organisation, les connexions disent les liens
// libres, les tags découpent en travers. Ces trois systèmes restent
// distincts, on ne fait que les croiser ici.
function ConnexionsTab({
  elements,
  links,
}: {
  elements: Element[];
  links: ElementLink[];
}) {
  const navigate = useNavigate();
  const { openPeek } = usePeek();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [lien, setLien] = useState<'tous' | 'relies' | 'orphelins'>('tous');
  const [rang, setRang] = useState<'tous' | 'groupes' | 'racines'>('tous');
  const [chrono, setChrono] = useState<'tous' | 'dedans' | 'dehors'>('tous');

  const { data: relations } = useQuery({
    queryKey: ['all-relations'],
    queryFn: listAllRelations,
  });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listAllTags });
  const { data: elementTags } = useQuery({
    queryKey: ['element-tags'],
    queryFn: listAllElementTags,
  });

  // Nombre de liens libres (relations + backlinks) par Element. La
  // hiérarchie n'entre pas dans ce compte : un enfant n'est pas une
  // connexion.
  const linkCount = useMemo(() => {
    const map = new Map<string, number>();
    const bump = (id: string) => map.set(id, (map.get(id) ?? 0) + 1);
    relations?.forEach((r) => {
      bump(r.source_id);
      bump(r.target_id);
    });
    return map;
  }, [relations]);

  const tagsByElement = useMemo(() => {
    const map = new Map<string, Set<string>>();
    elementTags?.forEach((et) => {
      const set = map.get(et.element_id) ?? new Set<string>();
      set.add(et.tag_id);
      map.set(et.element_id, set);
    });
    return map;
  }, [elementTags]);

  const groups = useMemo(
    () => elements.filter((e) => hasChildren(links, e.id)),
    [elements, links]
  );

  const results = useMemo(() => {
    const inGroup = groupId ? getDescendantIds(links, groupId) : null;
    const q = query.trim().toLowerCase();

    return elements
      .filter((e) => {
        if (q && !displayName(e).toLowerCase().includes(q)) return false;
        if (inGroup && !inGroup.has(e.id)) return false;
        if (tagId && !tagsByElement.get(e.id)?.has(tagId)) return false;
        if (chrono === 'dedans' && !e.timeline) return false;
        if (chrono === 'dehors' && e.timeline) return false;
        const count = linkCount.get(e.id) ?? 0;
        if (lien === 'relies' && count === 0) return false;
        if (lien === 'orphelins' && count > 0) return false;
        if (rang === 'groupes' && !hasChildren(links, e.id)) return false;
        if (rang === 'racines' && parentsOf(links, elements, e.id).length > 0)
          return false;
        return true;
      })
      .sort(
        (a, b) => (linkCount.get(b.id) ?? 0) - (linkCount.get(a.id) ?? 0)
      );
  }, [
    elements, links, query, groupId, tagId, chrono, lien, rang,
    linkCount, tagsByElement,
  ]);

  const active =
    !!query || !!groupId || !!tagId || lien !== 'tous' || rang !== 'tous' ||
    chrono !== 'tous';

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Chercher parmi les Elements…"
        className="mb-5 w-full border-b border-line bg-transparent pb-2.5 text-[17px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink"
      />

      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-3">
        <FilterRow
          label="Liens"
          value={lien}
          onChange={setLien}
          options={[
            ['tous', 'Tous'],
            ['relies', 'Reliés'],
            ['orphelins', 'Sans lien'],
          ]}
        />
        <FilterRow
          label="Hiérarchie"
          value={rang}
          onChange={setRang}
          options={[
            ['tous', 'Tous'],
            ['groupes', 'Groupes'],
            ['racines', 'Racines'],
          ]}
        />
        <FilterRow
          label="Chronologie"
          value={chrono}
          onChange={setChrono}
          options={[
            ['tous', 'Tous'],
            ['dedans', 'Dedans'],
            ['dehors', 'Dehors'],
          ]}
        />
      </div>

      {(groups.length > 0 || (tags?.length ?? 0) > 0) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {groups.slice(0, 8).map((g) => (
            <Chip
              key={g.id}
              active={groupId === g.id}
              onClick={() => setGroupId(groupId === g.id ? null : g.id)}
            >
              {displayName(g)}
            </Chip>
          ))}
          {tags?.slice(0, 10).map((t) => (
            <Chip
              key={t.id}
              active={tagId === t.id}
              tone="var(--color-fluo-mention)"
              onClick={() => setTagId(tagId === t.id ? null : t.id)}
            >
              #{t.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-[14px] text-ink-4">
        <span>
          {results.length} Element{results.length > 1 ? 's' : ''}
        </span>
        {active && (
          <button
            onClick={() => {
              setQuery('');
              setGroupId(null);
              setTagId(null);
              setLien('tous');
              setRang('tous');
              setChrono('tous');
            }}
            className="font-medium text-ink-3 transition hover:text-ink"
          >
            Tout réafficher
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="text-[16px] text-ink-4">
          Aucun Element ne réunit ces critères.
        </p>
      ) : (
        <div className="space-y-0.5">
          {results.map((el) => (
            <div
              key={el.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-surface-2"
            >
              <button
                onClick={() => navigate(`/elements/${el.id}`)}
                className="min-w-0 flex-1 truncate text-left text-[18px] text-ink"
              >
                {displayName(el)}
              </button>
              {el.timeline && (
                <Clock size={14} strokeWidth={2} className="shrink-0 text-ink-4" />
              )}
              {/* Regarder sans quitter la liste : on garde sa recherche. */}
              <button
                onClick={() => openPeek(el.id)}
                className="shrink-0 text-[13.5px] font-medium text-ink-4 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                Aperçu
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  // role/aria-label : plusieurs filtres partagent un libellé avec les
  // onglets ("Groupes"), le groupe nommé lève l'ambiguïté — pour un lecteur
  // d'écran comme pour un test.
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2.5">
      <span className="text-[13px] font-semibold text-ink-3">{label}</span>
      <div className="flex gap-1.5">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`rounded-full px-2.5 py-1 text-[13.5px] transition ${
              value === v
                ? 'bg-ink font-medium text-white'
                : 'text-ink-3 hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={active && tone ? { backgroundColor: tone } : undefined}
      className={`rounded-full px-3 py-1.5 text-[14px] transition ${
        active
          ? tone
            ? 'font-medium text-ink'
            : 'bg-ink font-medium text-white'
          : 'bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
