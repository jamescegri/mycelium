import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createElement, listElements } from '../lib/elements';
import {
  childrenOf,
  hasChildren,
  listAllLinks,
  rootElements,
} from '../lib/links';
import { listAllRelations } from '../lib/relations';
import { listTemporalRelations } from '../lib/temporal';
import { normalizeEdges, topologicalOrder } from '../lib/timeline';
import { Layout } from '../components/Layout';
import { useCommandPalette } from '../components/CommandPalette';
import type { Element, ElementLink } from '../types';

type Tab = 'groupes' | 'temporal' | 'connexions';

const TAB_LABEL: Record<Tab, string> = {
  groupes: 'Groupes',
  temporal: 'Temporel',
  connexions: 'Connexions',
};

// Le Dashboard n'est pas "la page où sont rangés les Elements" : c'est un
// espace qui regarde le même réseau sous plusieurs angles. Aucune vue
// n'introduit de donnée propre — tout est dérivé de ce qui existe déjà
// (element_links, relations, temporal_relations). Un Groupe n'est rien
// d'autre qu'un Element qui a au moins un enfant.
export function DashboardPage() {
  const [tab, setTab] = useState<Tab>('groupes');
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
      <CaptureBar />

      <nav className="mb-8 flex gap-6 border-b border-neutral-100 pb-3 text-sm">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {tab === 'groupes' && (
        <GroupesTab elements={elements ?? []} links={links ?? []} />
      )}
      {tab === 'temporal' && <TemporalTab />}
      {tab === 'connexions' && <ConnexionsTab elements={elements ?? []} />}
    </Layout>
  );
}

// Écrire, chercher, ou créer un nouvel Element : le point d'entrée
// principal, toujours en haut, avant même les vues.
function CaptureBar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { open: openPalette } = useCommandPalette();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: (name: string) => createElement({ name, family: 'ELEMENTS' }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      setName('');
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) createMutation.mutate(name.trim());
  }

  return (
    <form className="mb-10 flex items-center gap-6 text-sm" onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Écrire quelque chose…"
        className="flex-1 border-b border-neutral-200 bg-transparent py-2.5 text-xl text-neutral-900 outline-none focus:border-neutral-400"
      />
      <button
        type="button"
        onClick={openPalette}
        className="shrink-0 text-neutral-500 hover:text-neutral-700"
      >
        Rechercher <span className="text-neutral-300">⌘K</span>
      </button>
      <button
        type="submit"
        disabled={!name.trim() || createMutation.isPending}
        className="shrink-0 text-neutral-500 hover:text-neutral-700 disabled:opacity-40"
      >
        + Nouvel Element
      </button>
    </form>
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
  const roots = rootElements(links, elements);
  const groups = roots.filter((e) => hasChildren(links, e.id));
  const standalone = roots.filter((e) => !hasChildren(links, e.id));

  return (
    <div>
      <div className="mb-8">
        {groups.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Pas encore de Groupe — rattache un enfant à un Element (bouton "+
            Nouvelle sous-page" ou "+" dans l'éditeur) pour qu'il en devienne
            un.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
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

      {standalone.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-neutral-500">Autres</div>
          <div className="space-y-2">
            {standalone.map((el) => (
              <button
                key={el.id}
                onClick={() => navigate(`/elements/${el.id}`)}
                className="block text-left text-base text-neutral-800 hover:text-yellow-600"
              >
                {el.name || 'Sans titre'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Aperçu d'un Groupe, comme un dossier qu'on entrouvre : ses premiers
// enfants, et pour chacun un aperçu de SES propres enfants — deux niveaux
// visibles sans avoir à cliquer. La carte elle-même ouvre la page du
// Groupe, qui montre à son tour ses enfants en cascade.
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
  const preview = allChildren.slice(0, 3);
  const remaining = allChildren.length - preview.length;

  return (
    <button
      onClick={onNavigate}
      className="flex flex-col rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-sm font-medium text-yellow-700">
          {(group.name || '?').charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-base font-medium text-neutral-900">
          {group.name || 'Sans titre'}
        </span>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2 border-l border-neutral-200 pl-3">
          {preview.map((child) => {
            const grandchildren = childrenOf(links, elements, child.id);
            const gcPreview = grandchildren.slice(0, 2);
            const gcRemaining = grandchildren.length - gcPreview.length;
            return (
              <div key={child.id}>
                <div className="truncate text-sm text-neutral-600">
                  {child.name || 'Sans titre'}
                </div>
                {gcPreview.length > 0 && (
                  <div className="mt-1 space-y-0.5 border-l border-neutral-100 pl-3">
                    {gcPreview.map((gc) => (
                      <div
                        key={gc.id}
                        className="truncate text-xs text-neutral-400"
                      >
                        {gc.name || 'Sans titre'}
                      </div>
                    ))}
                    {gcRemaining > 0 && (
                      <div className="text-xs text-neutral-300">
                        +{gcRemaining}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {remaining > 0 && (
            <div className="text-sm text-neutral-300">+{remaining} autres</div>
          )}
        </div>
      )}
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
      <p className="text-sm text-neutral-500">
        Aucune position temporelle définie pour l'instant. Depuis un
        Element, section "Connexions", relie-le "avant" ou "après" un autre
        pour le faire apparaître ici.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {ordered.map((el) => (
        <button
          key={el.id}
          onClick={() => navigate(`/elements/${el.id}`)}
          className="block text-left text-base text-neutral-800 hover:text-yellow-500"
        >
          {el.name || 'Sans titre'}
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
        <p className="text-xs text-neutral-400">
          Pas un graphe — un point de départ pour explorer.
        </p>
        <button
          onClick={() => setShowOrphans((v) => !v)}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          {showOrphans ? '← Les plus connectés' : 'Elements orphelins →'}
        </button>
      </div>
      {list.length === 0 && (
        <p className="text-sm text-neutral-400">
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
            className="flex w-full items-center justify-between text-left text-base text-neutral-800 hover:text-yellow-500"
          >
            <span className="truncate">{el.name || 'Sans titre'}</span>
            <span className="ml-2 shrink-0 text-xs text-neutral-400">
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
