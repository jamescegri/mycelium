import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Clock,
  FileText,
  FolderClosed,
  GripVertical,
  PenLine,
  Plus,
} from 'lucide-react';
import { createElement, listElements } from '../lib/elements';
import {
  childrenOf,
  getDescendantIds,
  hasChildren,
  listAllLinks,
  parentsOf,
  rootElements,
} from '../lib/links';
import { listAllRelations } from '../lib/relations';
import { listAllElementTags, listAllTags } from '../lib/tags';
import { usePeek } from '../components/PeekPanel';
import { listTemporalRelations } from '../lib/temporal';
import { chronologyOrder, placeInChronology } from '../lib/chronology';
import { extractPlainText } from '../lib/content';
import { pastelFor } from '../lib/palette';
import { displayName, isUntitled } from '../lib/display';
import { Layout } from '../components/Layout';
import { Pill } from '../components/Pill';
import { Callout } from '../components/Callout';
import type { Element, ElementLink } from '../types';

// Les quatre angles sont de vraies routes, pas un état local : le bouton
// Retour du navigateur fonctionne, et une vue peut être mise en favori.
const ANGLES = [
  { path: '/dashboard', label: 'Groupes' },
  { path: '/liste', label: 'Éléments' },
  { path: '/temporel', label: 'Temporel' },
  { path: '/connexions', label: 'Connexions' },
] as const;

// Le Dashboard n'est pas "la page où sont rangés les Elements" : c'est un
// espace qui regarde le même réseau sous plusieurs angles. Aucune vue
// n'introduit de donnée propre — tout est dérivé de ce qui existe déjà
// (element_links, relations, temporal_relations). Un Groupe n'est rien
// d'autre qu'un Element qui a au moins un enfant.
export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({
    queryKey: ['links'],
    queryFn: listAllLinks,
  });

  return (
    <Layout>
      <h1 className="title-display mb-2 text-[56px] text-ink">Mon réseau</h1>
      <p className="mb-10 text-[18px] text-ink-3">
        Tout ce que tu as écrit, rangé comme tu l'as relié.
      </p>

      <CaptureBar />

      <nav className="mb-10 flex gap-8 border-b border-line text-[16px]">
        {ANGLES.map((a) => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className={`-mb-px border-b-2 pb-3.5 transition ${
              path === a.path
                ? 'border-ink font-semibold text-ink'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {a.label}
          </button>
        ))}
      </nav>

      {path === '/dashboard' && (
        <GroupesTab elements={elements ?? []} links={links ?? []} />
      )}
      {path === '/liste' && (
        <ElementsTab elements={elements ?? []} links={links ?? []} />
      )}
      {path === '/temporel' && <TemporalTab />}
      {path === '/connexions' && (
        <ConnexionsTab elements={elements ?? []} links={links ?? []} />
      )}
    </Layout>
  );
}

// Ce qu'on tape ici devient le TEXTE de l'Element, pas son titre : une idée
// arrive rarement déjà nommée. L'Element s'ouvre donc sans titre, curseur
// dans le champ du titre, avec la phrase déjà écrite en dessous.
function paragraphDoc(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function CaptureBar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const createMutation = useMutation({
    mutationFn: (input: { text: string; timeline: boolean }) =>
      createElement({
        name: '',
        content: input.text ? paragraphDoc(input.text) : null,
        timeline: input.timeline,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      setText('');
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) createMutation.mutate({ text: text.trim(), timeline: false });
  }

  return (
    <div className="mb-12">
      <form
        className="flex items-center gap-3.5 rounded-2xl border-2 border-line bg-surface px-5 py-4 transition focus-within:border-ink"
        onSubmit={handleSubmit}
      >
        <PenLine size={20} strokeWidth={2} className="shrink-0 text-ink-4" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire une idée, un nom, un lieu…"
          className="min-w-0 flex-1 bg-transparent text-[19px] text-ink outline-none placeholder:text-ink-4"
        />
        {text.trim() && (
          <span className="shrink-0 text-[13px] font-medium text-ink-3">
            Entrée ↵
          </span>
        )}
      </form>

      {/* Créer sans rien avoir à écrire d'abord. Un Element temporel est un
          Element comme un autre — il se place simplement sur la timeline. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() =>
            createMutation.mutate({ text: text.trim(), timeline: false })
          }
          disabled={createMutation.isPending}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={2.25} />
          Ajouter un Element
        </button>
        <button
          onClick={() =>
            createMutation.mutate({ text: text.trim(), timeline: true })
          }
          disabled={createMutation.isPending}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Clock size={16} strokeWidth={2.25} />
          Ajouter dans la chronologie
        </button>
      </div>
    </div>
  );
}

function GroupesTab({
  elements,
  links,
}: {
  elements: Element[];
  links: ElementLink[];
}) {
  const navigate = useNavigate();

  // TOUS les Elements qui ont au moins un enfant, pas seulement ceux qui
  // sont à la racine. Avant, ranger un Groupe dans un autre le faisait
  // disparaître d'ici : le Dashboard se vidait à mesure qu'on organisait,
  // exactement l'inverse du but.
  const groups = elements.filter((e) => hasChildren(links, e.id));
  const roots = rootElements(links, elements);
  const unfiled = roots.filter((e) => !hasChildren(links, e.id));

  // Les Groupes racines d'abord : ce sont les grandes entrées de l'univers.
  const rootIds = new Set(roots.map((e) => e.id));
  const ordered = [
    ...groups.filter((g) => rootIds.has(g.id)),
    ...groups.filter((g) => !rootIds.has(g.id)),
  ];

  return (
    <div>
      <div className="mb-10">
        {ordered.length === 0 ? (
          <Callout icon={FolderClosed} tone="accent">
            Pas encore de Groupe — rattache un enfant à un Element (bouton "+
            Nouvelle sous-page" ou "+" dans l'éditeur) pour qu'il en devienne
            un.
          </Callout>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ordered.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                elements={elements}
                links={links}
                onNavigate={() => navigate(`/elements/${group.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {unfiled.length > 0 && (
        <div>
          <div className="mb-4 text-[14px] font-semibold text-ink-3">
            Pas encore rangés
          </div>
          <div className="space-y-0.5">
            {unfiled.map((el) => (
              <ElementRow
                key={el.id}
                element={el}
                onNavigate={() => navigate(`/elements/${el.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Une ligne d'Element : du texte, une icône, rien d'autre. Un Element non
// titré s'affiche par ses premiers mots, en retrait, pour qu'on repère d'un
// coup d'œil ce qui reste à nommer.
function ElementRow({
  element,
  onNavigate,
}: {
  element: Element;
  onNavigate: () => void;
}) {
  const untitled = isUntitled(element);
  return (
    <button
      onClick={onNavigate}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-[18px] transition hover:bg-surface-2"
    >
      {element.timeline ? (
        <Clock size={17} strokeWidth={2} className="shrink-0 text-ink-4" />
      ) : (
        <FileText size={17} strokeWidth={2} className="shrink-0 text-ink-4" />
      )}
      <span className={`truncate ${untitled ? 'text-ink-3 italic' : 'text-ink'}`}>
        {displayName(element)}
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter((e) => displayName(e).toLowerCase().includes(q));
  }, [elements, query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filtrer…"
        className="mb-6 w-full border-b border-line bg-transparent pb-2.5 text-[17px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink"
      />

      {filtered.length === 0 ? (
        <p className="text-[16px] text-ink-4">
          {elements.length === 0
            ? "Rien encore. Écris une idée là-haut pour commencer."
            : 'Aucun Element ne correspond.'}
        </p>
      ) : (
        <div className="space-y-0.5">
          {filtered.map((el) => {
            const parents = parentsOf(links, elements, el.id);
            return (
              <div key={el.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <ElementRow
                    element={el}
                    onNavigate={() => navigate(`/elements/${el.id}`)}
                  />
                </div>
                {parents.length > 0 && (
                  <span className="hidden shrink-0 text-[13.5px] text-ink-4 sm:block">
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

// Une carte de Groupe est un aplat fluo plein, pas une boîte blanche avec
// un filet : sur la grille c'est la couleur qui distingue les Groupes, et
// elle doit donc porter toute la carte. Texte noir par-dessus — le fluo est
// assez clair pour rester au-delà de 7:1.
function GroupCard({
  group,
  elements,
  links,
  onNavigate,
}: {
  group: Element;
  elements: Element[];
  links: ElementLink[];
  onNavigate: () => void;
}) {
  const allChildren = childrenOf(links, elements, group.id);
  const preview = allChildren.slice(0, 5);
  const remaining = allChildren.length - preview.length;
  const description = extractPlainText(group.content, 80);
  const colors = pastelFor(group.id);
  // Un Groupe rangé dans un autre dit où il se trouve : sans ça, voir tous
  // les Groupes à plat ferait perdre le fil de la hiérarchie.
  const parents = parentsOf(links, elements, group.id);

  return (
    <button
      onClick={onNavigate}
      style={{ backgroundColor: colors.bg, color: colors.text }}
      className="group flex cursor-pointer flex-col rounded-2xl p-7 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_34px_-14px_rgba(0,0,0,0.4)]"
    >
      {parents.length > 0 && (
        <div className="mb-1.5 truncate text-[13px] opacity-60">
          {displayName(parents[0])}
          {parents.length > 1 && ` +${parents.length - 1}`}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2.5">
        <FolderClosed size={19} strokeWidth={2.25} className="shrink-0" />
        <span className="title-display truncate text-[26px]">
          {displayName(group)}
        </span>
      </div>

      {description && (
        <p className="mb-5 line-clamp-2 text-[15px] leading-snug opacity-70">
          {description}
        </p>
      )}

      {preview.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {preview.map((child) => (
            <Pill
              key={child.id}
              className="border-0 bg-white/55 px-3 py-1 text-[13.5px] font-medium"
              style={{ color: colors.text }}
            >
              {displayName(child)}
            </Pill>
          ))}
          {remaining > 0 && (
            <Pill
              className="border-0 bg-white/35 px-3 py-1 text-[13.5px] font-medium"
              style={{ color: colors.text }}
            >
              +{remaining}
            </Pill>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-black/15 pt-4 text-[15px] font-semibold">
        Ouvrir
        <ArrowRight
          size={16}
          strokeWidth={2.5}
          className="transition group-hover:translate-x-1"
        />
      </div>
    </button>
  );
}

// La chronologie se manipule directement : on saisit une entrée et on la
// dépose dans un intervalle. Aucune mention de "avant"/"après" — ces
// relations restent la mécanique interne (lib/chronology.ts).
function TemporalTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const ordered = useMemo(
    () => chronologyOrder(elements ?? [], relations ?? []),
    [elements, relations]
  );

  const moveMutation = useMutation({
    mutationFn: ({
      id,
      previousId,
      nextId,
    }: {
      id: string;
      previousId: string | null;
      nextId: string | null;
    }) => placeInChronology(relations ?? [], id, previousId, nextId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['temporal-relations'] });
      queryClient.invalidateQueries({ queryKey: ['elements'] });
    },
  });

  if (ordered.length === 0) {
    return (
      <Callout icon={Clock}>
        La chronologie est vide. Ouvre n'importe quel Element et choisis
        "Placer dans la chronologie" — aucun Element n'a besoin d'être d'un
        type particulier pour y entrer.
      </Callout>
    );
  }

  // Déposer dans l'intervalle i, c'est se placer entre ordered[i-1] et
  // ordered[i]. L'Element déplacé est ignoré dans ce calcul : sinon on se
  // positionnerait par rapport à soi-même.
  function dropAt(slot: number) {
    if (!dragId) return;
    const without = ordered.filter((e) => e.id !== dragId);
    const removedBefore = ordered.findIndex((e) => e.id === dragId) < slot;
    const index = removedBefore ? slot - 1 : slot;
    moveMutation.mutate({
      id: dragId,
      previousId: without[index - 1]?.id ?? null,
      nextId: without[index]?.id ?? null,
    });
    setDragId(null);
    setOverSlot(null);
  }

  return (
    <div>
      <p className="mb-5 text-[14px] text-ink-4">
        Glisse une entrée pour la déplacer.
      </p>
      <div>
        {ordered.map((el, i) => (
          <div key={el.id}>
            <DropSlot
              active={overSlot === i && dragId !== null}
              armed={dragId !== null}
              onOver={() => setOverSlot(i)}
              onDrop={() => dropAt(i)}
            />
            <div
              draggable
              onDragStart={() => setDragId(el.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverSlot(null);
              }}
              className={`group flex cursor-grab items-center gap-3 rounded-lg px-2 py-2.5 transition active:cursor-grabbing ${
                dragId === el.id ? 'opacity-40' : 'hover:bg-surface-2'
              }`}
            >
              <GripVertical
                size={16}
                strokeWidth={2}
                className="shrink-0 text-ink-4 opacity-0 transition group-hover:opacity-100"
              />
              <button
                onClick={() => navigate(`/elements/${el.id}`)}
                className="min-w-0 flex-1 truncate text-left text-[19px] text-ink"
              >
                {displayName(el)}
              </button>
            </div>
          </div>
        ))}
        <DropSlot
          active={overSlot === ordered.length && dragId !== null}
          armed={dragId !== null}
          onOver={() => setOverSlot(ordered.length)}
          onDrop={() => dropAt(ordered.length)}
        />
      </div>
    </div>
  );
}

// L'intervalle garde toujours une cible réelle, même au repos : une zone de
// dépôt qui n'apparaît qu'une fois le glisser commencé est difficile à
// viser. Elle s'élargit pendant le glisser, et ne se VOIT que là — au repos
// la chronologie reste une liste de titres, pas une grille de zones.
function DropSlot({
  active,
  armed,
  onOver,
  onDrop,
}: {
  active: boolean;
  armed: boolean;
  onOver: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`flex items-center transition-all ${armed ? 'h-7' : 'h-2'}`}
    >
      <div
        className={`h-[3px] w-full rounded-full transition ${
          active ? 'bg-fluo-parent' : 'bg-transparent'
        }`}
      />
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
