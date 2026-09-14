import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { createElement, listElements } from '../lib/elements';
import { childrenOf, hasChildren, listAllLinks, parentsOf } from '../lib/links';
import { listAllElementTags, listAllTags } from '../lib/tags';
import { listAllRelations } from '../lib/relations';
import { listTemporalRelations } from '../lib/temporal';
import { timelineRows } from '../lib/chronology';
import { extractPlainText } from '../lib/content';
import { displayName, isUntitled } from '../lib/display';
import { pastelFor } from '../lib/palette';
import { useCommandPalette } from './CommandPalette';
import type { Element, ElementLink } from '../types';

// La colonne du milieu sert à naviguer, la troisième à lire. Ce qu'elle
// montre dépend de l'endroit du rail où l'on se trouve : on ne parcourt
// pas des Groupes comme on parcourt des Tags. Ouvrir un Element ne la
// change pas — c'est ce qui permet d'enchaîner les lectures sans reperdre
// à chaque fois le fil qu'on suivait.
type Panel = 'groupes' | 'tags' | 'chronologie';

function panelFor(pathname: string): Panel {
  if (pathname.startsWith('/tags')) return 'tags';
  if (pathname.startsWith('/temporel')) return 'chronologie';
  return 'groupes';
}


// Les filtres répondent à des moments d'écriture, pas à la structure :
// "qu'est-ce que j'ai laissé sans titre", "qu'est-ce qui reste à écrire",
// "où j'en étais". D'où des critères d'état plutôt que de rangement.
export interface Filters {
  tagIds: string[];
  untitled: boolean;
  empty: boolean;
  recent: boolean;
  unlinked: boolean;
}

const NO_FILTERS: Filters = {
  tagIds: [],
  untitled: false,
  empty: false,
  recent: false,
  unlinked: false,
};

function isFiltering(f: Filters): boolean {
  return (
    f.tagIds.length > 0 || f.untitled || f.empty || f.recent || f.unlinked
  );
}

// `wide` : tant qu'aucun Element n'est ouvert, la colonne prend toute la
// place — on est en train d'explorer, autant le faire au large. Elle se
// resserre dès qu'il y a quelque chose à lire à côté. La largeur et le fond
// sont portés par le panneau qui l'accueille (voir Layout).
export function NavColumn({ wide = false }: { wide?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { open: openPalette } = useCommandPalette();
  const [filter, setFilter] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const panel = panelFor(location.pathname);

  const createMutation = useMutation({
    mutationFn: () => createElement({ name: '' }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  // Au large, le contenu garde une largeur de lecture et se centre : une
  // liste étirée sur 1400 px se parcourt mal, l'œil perd la colonne.
  const inner = wide ? 'mx-auto w-full max-w-[48rem]' : 'w-full';

  return (
    <div className="flex min-h-0 w-full flex-col">
      {/* L'explorateur au large se passe de ces deux-là : la recherche
          globale reste sous ⌘K, et écrire une idée est le geste de
          l'Accueil. Ici on vient parcourir ce qui existe déjà. */}
      {!wide && (
        <div className={`${inner} px-4 pt-5 pb-3`}>
          <button
            onClick={openPalette}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-left text-[13.5px] text-ink-3 transition hover:border-ink-4"
          >
            <Search size={15} strokeWidth={2} className="shrink-0" />
            Rechercher
            <span className="ml-auto text-[12px] text-ink-4">⌘K</span>
          </button>
        </div>
      )}

      <div className={`${inner} px-4 ${wide ? 'pt-6' : ''} pb-3`}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer cette liste…"
          className="w-full border-b border-line bg-transparent pb-2 text-[13px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink"
        />
      </div>

      {panel === 'groupes' && (
        <div className={`${inner} px-4 pb-3`}>
          <FilterBar value={filters} onChange={setFilters} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${inner} px-3 pb-3`}>
          {panel === 'groupes' && (
            <GroupesPanel filter={filter} filters={filters} wide={wide} />
          )}
          {panel === 'tags' && <TagsPanel filter={filter} />}
          {panel === 'chronologie' && <ChronologiePanel filter={filter} />}
        </div>
      </div>

      {/* Au large, la barre de capture couvre déjà la création : deux
          boutons pour le même geste feraient hésiter. */}
      {!wide && (
        <div className="border-t border-line-soft px-4 py-4">
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2.5} />
            Créer
          </button>
        </div>
      )}
    </div>
  );
}

// Les critères d'état tiennent sur une ligne ; les tags sont repliés
// derrière un bouton, parce qu'il peut y en avoir trente et qu'ils
// mangeraient l'écran avant qu'on ait commencé à chercher.
function FilterBar({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const [openTags, setOpenTags] = useState(false);
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listAllTags });

  const toggleTag = (id: string) =>
    onChange({
      ...value,
      tagIds: value.tagIds.includes(id)
        ? value.tagIds.filter((t) => t !== id)
        : [...value.tagIds, id],
    });

  const flags = [
    { key: 'untitled' as const, label: 'Sans titre' },
    { key: 'empty' as const, label: 'Vide' },
    { key: 'recent' as const, label: 'Récent' },
    { key: 'unlinked' as const, label: 'Jamais relié' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => setOpenTags((v) => !v)}
        aria-expanded={openTags}
        className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
          value.tagIds.length > 0
            ? 'border-ink bg-ink text-white'
            : 'border-line text-ink-2 hover:border-ink'
        }`}
      >
        Tags{value.tagIds.length > 0 && ` · ${value.tagIds.length}`}
      </button>

      {flags.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange({ ...value, [f.key]: !value[f.key] })}
          aria-pressed={value[f.key]}
          className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
            value[f.key]
              ? 'border-ink bg-ink text-white'
              : 'border-line text-ink-2 hover:border-ink'
          }`}
        >
          {f.label}
        </button>
      ))}

      {isFiltering(value) && (
        <button
          onClick={() => onChange(NO_FILTERS)}
          className="px-1.5 text-[12px] text-ink-4 transition hover:text-ink"
        >
          Effacer
        </button>
      )}

      {openTags && (
        <div className="mt-1 flex w-full flex-wrap gap-1.5">
          {(tags ?? []).length === 0 && (
            <span className="text-[13px] text-ink-4">Aucun tag créé.</span>
          )}
          {(tags ?? []).map((tag) => {
            const tone = pastelFor(tag.id);
            const on = value.tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                aria-pressed={on}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
                  on ? 'shadow-[0_0_0_1.5px_var(--color-ink)]' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: tone.bg, color: tone.text }}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PanelTitle({ children }: { children: string }) {
  return (
    <p className="mb-2.5 px-1.5 text-[12px] font-semibold tracking-[0.07em] text-ink-4 uppercase">
      {children}
    </p>
  );
}

function EmptyPanel({ children }: { children: string }) {
  return <p className="px-1.5 text-[13px] text-ink-4">{children}</p>;
}

// ── Groupes ──────────────────────────────────────────────────────────
// Un explorateur, pas une liste de raccourcis. Un Groupe n'est pas une
// entité : c'est un Element qui a des enfants. Il a donc un texte comme
// les autres, et il faut pouvoir l'atteindre aussi bien que le traverser —
// d'où deux gestes distincts, comme dans un Finder.
//
// En liste, un clic déplie sur place : on garde sous les yeux d'où l'on
// vient. En galerie, on entre dans le Groupe, parce que des cartes
// imbriquées ne voudraient plus rien dire.

type ExplorerView = 'liste' | 'galerie';

interface TreeRow {
  element: Element;
  depth: number;
  items: Element[];
}

// L'arbre aplati en lignes, en ne descendant que dans ce qui est déplié.
// `trail` est le chemin en cours, pas l'ensemble des Elements déjà vus :
// un Element rangé dans deux Groupes doit apparaître aux deux endroits,
// seul un cycle doit arrêter la descente.
function treeRows(
  roots: Element[],
  elements: Element[],
  links: ElementLink[],
  expanded: Set<string>
): TreeRow[] {
  const rows: TreeRow[] = [];

  function walk(element: Element, depth: number, trail: Set<string>) {
    const children = childrenOf(links, elements, element.id);
    rows.push({ element, depth, items: children });
    if (!expanded.has(element.id) || trail.has(element.id)) return;
    const deeper = new Set(trail).add(element.id);
    for (const child of children) walk(child, depth + 1, deeper);
  }

  for (const root of roots) walk(root, 0, new Set());
  return rows;
}

function GroupesPanel({
  filter,
  filters,
  wide,
}: {
  filter: string;
  filters: Filters;
  wide: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<ExplorerView>('liste');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [path, setPath] = useState<Element[]>([]);

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: elementTags } = useQuery({
    queryKey: ['element-tags'],
    queryFn: listAllElementTags,
  });
  const { data: relations } = useQuery({
    queryKey: ['relations'],
    queryFn: listAllRelations,
  });

  // Filtrer, c'est chercher dans tout l'univers : on quitte alors
  // l'arborescence pour une liste de résultats. Garder l'imbrication
  // ferait chercher les réponses dans des dossiers à ouvrir un par un.
  const searching = isFiltering(filters);
  // Figé à l'ouverture : "récent" ne doit pas se déplacer sous les yeux
  // pendant qu'on lit la liste.
  const [mountedAt] = useState(() => Date.now());

  const all = useMemo(() => elements ?? [], [elements]);
  const allLinks = useMemo(() => links ?? [], [links]);
  const here = path[path.length - 1] ?? null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const roots = useMemo(
    () =>
      all.filter(
        (e) =>
          hasChildren(allLinks, e.id) &&
          parentsOf(allLinks, all, e.id).length === 0
      ),
    [all, allLinks]
  );

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const byName = (e: Element) =>
      !q || displayName(e).toLowerCase().includes(q);

    if (!searching) return { list: [] as Element[], byName };

    const linked = new Set<string>();
    for (const r of relations ?? []) {
      linked.add(r.source_id);
      linked.add(r.target_id);
    }
    const tagsOf = new Map<string, Set<string>>();
    for (const et of elementTags ?? []) {
      const set = tagsOf.get(et.element_id) ?? new Set<string>();
      set.add(et.tag_id);
      tagsOf.set(et.element_id, set);
    }
    const weekAgo = mountedAt - 7 * 24 * 3600 * 1000;

    const list = all.filter((e) => {
      if (!byName(e)) return false;
      if (filters.untitled && !isUntitled(e)) return false;
      if (filters.empty && extractPlainText(e.content, 1)) return false;
      if (filters.recent && new Date(e.updated_at).getTime() < weekAgo)
        return false;
      if (filters.unlinked && linked.has(e.id)) return false;
      if (filters.tagIds.length > 0) {
        const own = tagsOf.get(e.id);
        if (!own || !filters.tagIds.every((t) => own.has(t))) return false;
      }
      return true;
    });
    return { list, byName };
  }, [
    all,
    filter,
    filters,
    searching,
    relations,
    elementTags,
    mountedAt,
  ]);

  // Vue liste : l'arbre déplié, ou les résultats à plat quand on filtre.
  const rows = useMemo(() => {
    if (searching) {
      return matches.list.map((element) => ({
        element,
        depth: 0,
        items: childrenOf(allLinks, all, element.id),
      }));
    }
    return treeRows(roots.filter(matches.byName), all, allLinks, expanded);
  }, [searching, matches, roots, all, allLinks, expanded]);

  // Vue galerie : le contenu du Groupe où l'on se trouve.
  const cards = useMemo(() => {
    if (searching) return matches.list;
    const list = here
      ? childrenOf(allLinks, all, here.id)
      : roots;
    return list.filter(matches.byName);
  }, [searching, matches, here, allLinks, all, roots]);

  const open = (el: Element) => navigate(`/elements/${el.id}`);

  const count = rows.length || cards.length;

  const header = (
    <div className="mb-4 flex items-end gap-2">
      {here && !searching ? (
        <div className="min-w-0">
          <button
            onClick={() => setPath((p) => p.slice(0, -1))}
            className="mb-0.5 flex items-center gap-1 text-[12px] text-ink-4 transition hover:text-ink"
          >
            <ChevronLeft size={13} strokeWidth={2.2} />
            {path.length > 1 ? displayName(path[path.length - 2]) : 'Groupes'}
          </button>
          <h2 className="title-display truncate text-[26px]">
            {displayName(here)}
          </h2>
        </div>
      ) : (
        <h2 className="title-display text-[26px]">
          {searching
            ? `${count} résultat${count > 1 ? 's' : ''}`
            : 'Groupes'}
        </h2>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-line p-0.5">
        {(
          [
            { id: 'liste' as const, icon: List, label: 'Liste' },
            { id: 'galerie' as const, icon: LayoutGrid, label: 'Galerie' },
          ]
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            aria-label={v.label}
            title={v.label}
            className={`rounded-md p-1.5 transition ${
              view === v.id
                ? 'bg-accent text-white'
                : 'text-ink-4 hover:text-ink'
            }`}
          >
            <v.icon size={14} strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  );

  const empty =
    view === 'liste' ? rows.length === 0 : cards.length === 0;

  return (
    <>
      {header}

      {empty ? (
        <EmptyPanel>
          {searching
            ? 'Aucun Element ne correspond.'
            : here
              ? 'Ce Groupe est vide.'
              : "Rattache un enfant à un Element pour qu'il devienne un Groupe."}
        </EmptyPanel>
      ) : view === 'liste' ? (
        <div className="flex flex-col">
          {rows.map((row, i) => (
            <ExplorerRow
              key={`${row.element.id}-${i}`}
              row={row}
              expanded={expanded.has(row.element.id)}
              active={location.pathname === `/elements/${row.element.id}`}
              onToggle={() => toggle(row.element.id)}
              onOpen={() => open(row.element)}
            />
          ))}
        </div>
      ) : (
        <div
          className={`grid gap-2.5 ${
            wide
              ? 'grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]'
              : 'grid-cols-1'
          }`}
        >
          {cards.map((el) => (
            <GalleryCard
              key={el.id}
              element={el}
              items={childrenOf(allLinks, all, el.id)}
              active={location.pathname === `/elements/${el.id}`}
              onEnter={
                searching ? undefined : () => setPath((p) => [...p, el])
              }
              onOpen={() => open(el)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Une ligne d'explorateur. Un Element sans enfants s'ouvre au premier clic
// — il n'y a rien à déplier, faire attendre un second clic n'apporterait
// rien. Un Groupe se déplie au clic et s'ouvre au double clic.
function ExplorerRow({
  row,
  expanded,
  active,
  onToggle,
  onOpen,
}: {
  row: TreeRow;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const isGroup = row.items.length > 0;
  const tone = pastelFor(row.element.id);

  return (
    <div
      style={{ paddingLeft: row.depth * 18 }}
      className={`flex items-center gap-1 rounded-lg pr-2 transition ${
        active ? 'bg-surface-3' : 'hover:bg-surface-2'
      }`}
    >
      {isGroup ? (
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Replier' : 'Déplier'}
          className="shrink-0 rounded p-1 text-ink-4 transition hover:text-ink"
        >
          <ChevronRight
            size={13}
            strokeWidth={2.4}
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
      ) : (
        <span className="w-[21px] shrink-0" aria-hidden />
      )}

      <button
        onClick={isGroup ? onToggle : onOpen}
        onDoubleClick={onOpen}
        title={isGroup ? 'Double-clic pour ouvrir' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
      >
        <span
          className="size-2.5 shrink-0 rounded-[3px]"
          style={
            isGroup
              ? { backgroundColor: tone.bg }
              : { boxShadow: `inset 0 0 0 2px ${tone.bg}` }
          }
        />
        <span
          className={`truncate text-[13.5px] ${
            active ? 'font-semibold' : isGroup ? 'font-medium' : ''
          } ${isUntitled(row.element) ? 'text-ink-3 italic' : ''}`}
        >
          {displayName(row.element)}
        </span>
        {isGroup && (
          <span className="ml-auto shrink-0 text-[12px] tabular-nums text-ink-4">
            {row.items.length}
          </span>
        )}
      </button>
    </div>
  );
}

// Une carte de galerie montre de quoi reconnaître l'Element sans l'ouvrir :
// ses premiers mots, et ce qu'il contient.
function GalleryCard({
  element,
  items,
  active,
  onEnter,
  onOpen,
}: {
  element: Element;
  items: Element[];
  active: boolean;
  onEnter?: () => void;
  onOpen: () => void;
}) {
  const isGroup = items.length > 0 && !!onEnter;
  const tone = pastelFor(element.id);
  const excerpt = extractPlainText(element.content, 90);
  const shown = items.slice(0, 4);
  const rest = items.length - shown.length;

  return (
    <button
      onClick={isGroup ? onEnter : onOpen}
      onDoubleClick={onOpen}
      title={isGroup ? 'Double-clic pour ouvrir ce Groupe' : undefined}
      aria-current={active ? 'true' : undefined}
      className={`flex flex-col gap-2.5 rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]'
          : 'border-line hover:border-ink-4'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className="size-3 shrink-0 rounded-[4px]"
          style={
            isGroup
              ? { backgroundColor: tone.bg }
              : { boxShadow: `inset 0 0 0 2px ${tone.bg}` }
          }
        />
        <span
          className={`truncate text-[14.5px] font-semibold ${
            isUntitled(element) ? 'text-ink-3 italic' : ''
          }`}
        >
          {displayName(element)}
        </span>
        {items.length > 0 && (
          <span className="ml-auto shrink-0 text-[12px] tabular-nums text-ink-4">
            {items.length}
          </span>
        )}
      </span>

      {excerpt && (
        <span className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">
          {excerpt}
        </span>
      )}

      {shown.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {shown.map((child) => {
            const t = pastelFor(child.id);
            return (
              <span
                key={child.id}
                className="max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: t.bg, color: t.text }}
              >
                {displayName(child)}
              </span>
            );
          })}
          {rest > 0 && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-3">
              +{rest}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
// ── Tags ─────────────────────────────────────────────────────────────
// Un Tag n'a pas de page : il sert à filtrer. Il vit donc ici, dans la
// colonne de navigation, et jamais comme une destination qui aurait du
// contenu à elle.
function TagsPanel({ filter }: { filter: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const activeTag = params.get('tag');

  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: listAllTags });
  const { data: elementTags } = useQuery({
    queryKey: ['element-tags'],
    queryFn: listAllElementTags,
  });

  const counted = useMemo(() => {
    const counts = new Map<string, number>();
    for (const et of elementTags ?? []) {
      counts.set(et.tag_id, (counts.get(et.tag_id) ?? 0) + 1);
    }
    const q = filter.trim().toLowerCase();
    return (tags ?? [])
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .map((t) => ({ tag: t, count: counts.get(t.id) ?? 0 }));
  }, [tags, elementTags, filter]);

  if (counted.length === 0) {
    return (
      <>
        <PanelTitle>Tous les tags</PanelTitle>
        <EmptyPanel>
          Pas encore de tag. Ajoutes-en un depuis les propriétés d'un Element.
        </EmptyPanel>
      </>
    );
  }

  return (
    <>
      <PanelTitle>Tous les tags</PanelTitle>
      <div className="flex flex-wrap gap-1.5 px-0.5">
        {counted.map(({ tag, count }) => {
          const tone = pastelFor(tag.id);
          const active = activeTag === tag.id;
          return (
            <button
              key={tag.id}
              onClick={() => navigate(`/tags?tag=${tag.id}`)}
              aria-current={active ? 'true' : undefined}
              className={`inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium transition ${
                active
                  ? 'shadow-[0_0_0_1.5px_var(--color-ink)]'
                  : 'opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: tone.bg, color: tone.text }}
            >
              {tag.name}
              <span className="text-[11px] tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Chronologie ──────────────────────────────────────────────────────
// Le récit emboîté, lu dans l'ordre : l'indentation dit ce qui contient
// quoi. Filtrer aplatit volontairement l'arbre — quand on cherche un nom,
// on veut le trouver, pas reconstituer son chemin.
function ChronologiePanel({ filter }: { filter: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const rows = useMemo(() => {
    const all = timelineRows(elements ?? [], links ?? [], relations ?? []);
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      displayName(r.element).toLowerCase().includes(q)
    );
  }, [elements, links, relations, filter]);

  if (rows.length === 0) {
    return (
      <>
        <PanelTitle>Chronologie</PanelTitle>
        <EmptyPanel>
          Aucun Element situé dans le temps pour l'instant.
        </EmptyPanel>
      </>
    );
  }

  return (
    <>
      <PanelTitle>Chronologie</PanelTitle>
      <div className="flex flex-col">
        {rows.map((row, i) => {
          const tone = pastelFor(row.element.id);
          const active = location.pathname === `/elements/${row.element.id}`;
          return (
            <button
              key={`${row.element.id}-${i}`}
              onClick={() => navigate(`/elements/${row.element.id}`)}
              aria-current={active ? 'true' : undefined}
              style={{ paddingLeft: 10 + row.depth * 14 }}
              className={`flex items-center gap-2 rounded-lg py-1.5 pr-2.5 text-left transition ${
                active ? 'bg-surface-3 font-semibold' : 'hover:bg-surface-2'
              } ${row.depth === 0 ? 'text-[13.5px] font-medium' : 'text-[13.5px]'}`}
            >
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={
                  row.childCount > 0
                    ? { backgroundColor: tone.bg }
                    : { boxShadow: `inset 0 0 0 1.5px ${tone.bg}` }
                }
              />
              <span className="truncate">{displayName(row.element)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
