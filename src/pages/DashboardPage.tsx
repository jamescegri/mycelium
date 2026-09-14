import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FolderClosed } from 'lucide-react';
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
import { extractPlainText } from '../lib/content';
import { pastelFor } from '../lib/palette';
import { Layout } from '../components/Layout';
import { Pill } from '../components/Pill';
import { Callout } from '../components/Callout';
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

// Écrire un nom et créer directement : Rechercher et +Nouvel Element vivent
// maintenant dans la sidebar, toujours visibles — pas besoin de les
// dupliquer ici.
function CaptureBar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    <form className="mb-10" onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Écrire quelque chose… (Entrée pour créer)"
        className="w-full border-b border-neutral-200 bg-transparent py-2.5 text-xl text-neutral-900 outline-none focus:border-neutral-400"
      />
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
          <Callout icon={FolderClosed} tone="yellow">
            Pas encore de Groupe — rattache un enfant à un Element (bouton "+
            Nouvelle sous-page" ou "+" dans l'éditeur) pour qu'il en devienne
            un.
          </Callout>
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

// Carte façon dossier coloré : fond pastel stable (dérivé de l'id), un
// aperçu du contenu si l'Element en a écrit, ses premiers enfants en
// pastilles, et un lien "Ouvrir" en pied de carte — la carte entière reste
// cliquable. La page du Groupe montre ensuite ses enfants en cascade.
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
  const preview = allChildren.slice(0, 6);
  const remaining = allChildren.length - preview.length;
  const description = extractPlainText(group.content, 90);
  const colors = pastelFor(group.id);

  return (
    <button
      onClick={onNavigate}
      style={{ backgroundColor: colors.bg }}
      className="group flex cursor-pointer flex-col rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-1 flex items-center gap-2">
        <FolderClosed size={16} strokeWidth={1.75} style={{ color: colors.text }} />
        <span
          className="truncate text-base font-semibold"
          style={{ color: colors.text }}
        >
          {group.name || 'Sans titre'}
        </span>
      </div>

      {description && (
        <p
          className="mb-3 line-clamp-2 text-sm opacity-80"
          style={{ color: colors.text }}
        >
          {description}
        </p>
      )}

      {preview.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {preview.map((child) => (
            <Pill
              key={child.id}
              className="border-0 bg-white/70"
              style={{ color: colors.text }}
            >
              {child.name || 'Sans titre'}
            </Pill>
          ))}
          {remaining > 0 && (
            <Pill className="border-0 bg-white/50" style={{ color: colors.text }}>
              +{remaining}
            </Pill>
          )}
        </div>
      )}

      <div
        className="mt-auto flex items-center gap-1 border-t pt-3 text-sm font-medium"
        style={{ borderColor: colors.ring, color: colors.text }}
      >
        Ouvrir
        <ArrowRight
          size={14}
          strokeWidth={2}
          className="transition group-hover:translate-x-0.5"
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
