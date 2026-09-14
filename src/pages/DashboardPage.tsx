import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Clock,
  FileText,
  FolderClosed,
  PenLine,
  Plus,
} from 'lucide-react';
import { createElement, listElements } from '../lib/elements';
import {
  childrenOf,
  hasChildren,
  listAllLinks,
  parentsOf,
  rootElements,
} from '../lib/links';
import { listAllRelations } from '../lib/relations';
import { listTemporalRelations } from '../lib/temporal';
import { normalizeEdges, topologicalOrder } from '../lib/timeline';
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
      {path === '/connexions' && <ConnexionsTab elements={elements ?? []} />}
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
    mutationFn: (input: { text: string; family: 'ELEMENTS' | 'TIME' }) =>
      createElement({
        name: '',
        family: input.family,
        content: input.text ? paragraphDoc(input.text) : null,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      setText('');
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) createMutation.mutate({ text: text.trim(), family: 'ELEMENTS' });
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
            createMutation.mutate({ text: text.trim(), family: 'ELEMENTS' })
          }
          disabled={createMutation.isPending}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={2.25} />
          Ajouter un Element
        </button>
        <button
          onClick={() =>
            createMutation.mutate({ text: text.trim(), family: 'TIME' })
          }
          disabled={createMutation.isPending}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Clock size={16} strokeWidth={2.25} />
          Ajouter un Element temporel
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
      {element.family === 'TIME' ? (
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

function TemporalTab() {
  const navigate = useNavigate();
  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: relations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const ordered = useMemo(() => {
    if (!elements || !relations || relations.length === 0) return [];
    const edges = normalizeEdges(relations);
    const nodeIds = [
      ...new Set(relations.flatMap((r) => [r.element_a, r.element_b])),
    ];
    const byId = new Map(elements.map((e) => [e.id, e]));
    return topologicalOrder(nodeIds, edges)
      .map((id) => byId.get(id))
      .filter((e): e is Element => !!e);
  }, [elements, relations]);

  if (ordered.length === 0) {
    return (
      <Callout>
        Aucune position temporelle définie pour l'instant. Depuis un
        Element, section "Connexions", relie-le "avant" ou "après" un autre
        pour le faire apparaître ici.
      </Callout>
    );
  }

  return (
    <div className="space-y-1.5">
      {ordered.map((el) => (
        <button
          key={el.id}
          onClick={() => navigate(`/elements/${el.id}`)}
          className="block py-1 text-left text-[19px] text-ink hover:opacity-60"
        >
          {displayName(el)}
        </button>
      ))}
    </div>
  );
}

function ConnexionsTab({ elements }: { elements: Element[] }) {
  const navigate = useNavigate();
  const [showOrphans, setShowOrphans] = useState(false);
  const { data: relations } = useQuery({
    queryKey: ['all-relations'],
    queryFn: listAllRelations,
  });
  const { data: temporalRelations } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    const bump = (id: string) => map.set(id, (map.get(id) ?? 0) + 1);
    relations?.forEach((r) => {
      bump(r.source_id);
      bump(r.target_id);
    });
    temporalRelations?.forEach((r) => {
      bump(r.element_a);
      bump(r.element_b);
    });
    return map;
  }, [relations, temporalRelations]);

  const withCounts = elements
    .map((e) => ({ el: e, count: counts.get(e.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const list = showOrphans
    ? withCounts.filter((i) => i.count === 0)
    : withCounts.filter((i) => i.count > 0).slice(0, 10);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[14px] text-ink-4">
          Pas un graphe — un point de départ pour explorer.
        </p>
        <button
          onClick={() => setShowOrphans((v) => !v)}
          className="text-[14px] font-medium text-ink-3 hover:text-ink"
        >
          {showOrphans ? '← Les plus connectés' : 'Elements orphelins →'}
        </button>
      </div>
      {list.length === 0 && (
        <p className="text-[16px] text-ink-4">
          {showOrphans
            ? 'Aucun Element orphelin — tout est relié à quelque chose.'
            : "Aucune connexion pour l'instant."}
        </p>
      )}
      <div className="space-y-1.5">
        {list.map(({ el, count }) => (
          <button
            key={el.id}
            onClick={() => navigate(`/elements/${el.id}`)}
            className="flex w-full items-center justify-between py-1 text-left text-[19px] text-ink hover:opacity-60"
          >
            <span className="truncate">{displayName(el)}</span>
            <span className="ml-2 shrink-0 text-[14px] text-ink-4">
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
