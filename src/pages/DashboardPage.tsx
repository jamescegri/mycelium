import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listElements } from '../lib/elements';
import { listAllRelations } from '../lib/relations';
import { listTemporalRelations } from '../lib/temporal';
import { normalizeEdges, topologicalOrder } from '../lib/timeline';
import { listCollections, createCollection } from '../lib/collections';
import { FAMILY_COLOR } from '../lib/family';
import { Layout } from '../components/Layout';
import type { Element, ElementFamily } from '../types';

type Tab = 'arbo' | 'temporal' | 'connexions' | 'collections';

const TAB_LABEL: Record<Tab, string> = {
  arbo: 'Arborescence',
  temporal: 'Temporel',
  connexions: 'Connexions',
  collections: 'Collections',
};

// Le Dashboard n'est pas "la page où sont rangés les Elements" : c'est un
// espace qui regarde le même réseau sous plusieurs angles. Aucune vue
// n'introduit de donnée propre — tout est dérivé de ce qui existe déjà
// (parent_id, relations, temporal_relations, collections).
export function DashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('arbo');
  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });

  return (
    <Layout>
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

      {tab === 'arbo' && (
        <ArborescenceTab
          elements={elements ?? []}
          onNavigate={(f) => navigate(`/space/${f}`)}
        />
      )}
      {tab === 'temporal' && <TemporalTab />}
      {tab === 'connexions' && <ConnexionsTab elements={elements ?? []} />}
      {tab === 'collections' && <CollectionsTab />}
    </Layout>
  );
}

function ArborescenceTab({
  elements,
  onNavigate,
}: {
  elements: Element[];
  onNavigate: (family: ElementFamily) => void;
}) {
  const families: ElementFamily[] = ['TIME', 'SPACE', 'ELEMENTS'];
  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:gap-14">
      {families.map((f) => {
        const count = elements.filter(
          (e) => !e.parent_id && e.family === f
        ).length;
        return (
          <button
            key={f}
            onClick={() => onNavigate(f)}
            className="group text-left"
          >
            <div
              className="text-3xl font-semibold tracking-tight"
              style={{ color: FAMILY_COLOR[f] }}
            >
              {f}
            </div>
            <div className="mt-1 text-xs text-neutral-400 group-hover:text-neutral-600">
              {count} Element{count !== 1 ? 's' : ''}
            </div>
          </button>
        );
      })}
    </div>
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
          className="block text-left text-[15px] text-neutral-800 hover:text-yellow-500"
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
            className="flex w-full items-center justify-between text-left text-[15px] text-neutral-800 hover:text-yellow-500"
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

function CollectionsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
  });

  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setCreating(false);
      setName('');
      navigate(`/collections/${created.id}`);
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) createMutation.mutate(name.trim());
  }

  return (
    <div>
      <div className="space-y-1.5">
        {collections?.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/collections/${c.id}`)}
            className="block text-left text-[15px] text-neutral-800 hover:text-yellow-500"
          >
            {c.name}
          </button>
        ))}
        {collections?.length === 0 && (
          <p className="text-sm text-neutral-400">
            Aucune collection pour l'instant.
          </p>
        )}
      </div>
      {creating ? (
        <form onSubmit={handleCreate} className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la collection"
            className="flex-1 border-b border-neutral-200 bg-transparent px-1 py-1 text-sm text-neutral-900 outline-none focus:border-neutral-400"
          />
          <button
            type="submit"
            className="text-sm text-neutral-600 hover:text-neutral-800"
          >
            Créer
          </button>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-3 text-sm text-neutral-500 hover:text-neutral-700"
        >
          + Nouvelle collection
        </button>
      )}
    </div>
  );
}
