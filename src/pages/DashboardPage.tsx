import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FileText, FolderClosed, PenLine } from 'lucide-react';
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
      <h1 className="title-display mb-2 text-[56px] text-ink">Mon réseau</h1>
      <p className="mb-10 text-[18px] text-ink-3">
        Tout ce que tu as écrit, rangé comme tu l'as relié.
      </p>

      <CaptureBar />

      <nav className="mb-10 flex gap-8 border-b border-line text-[16px]">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-3.5 transition ${
              tab === t
                ? 'border-ink font-semibold text-ink'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
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
    <form className="mb-12 flex items-center gap-3.5 rounded-2xl border-2 border-line bg-surface px-5 py-4 transition focus-within:border-ink" onSubmit={handleSubmit}>
      <PenLine size={20} strokeWidth={2} className="shrink-0 text-ink-4" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Écrire une idée, un nom, un lieu…"
        className="min-w-0 flex-1 bg-transparent text-[19px] text-ink outline-none placeholder:text-ink-4"
      />
      {name.trim() && (
        <span className="shrink-0 text-[13px] font-medium text-ink-3">
          Entrée ↵
        </span>
      )}
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
          <Callout icon={FolderClosed} tone="accent">
            Pas encore de Groupe — rattache un enfant à un Element (bouton "+
            Nouvelle sous-page" ou "+" dans l'éditeur) pour qu'il en devienne
            un.
          </Callout>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
          <div className="mb-4 text-[14px] font-semibold text-ink-3">
            Pas encore rangés
          </div>
          <div className="space-y-0.5">
            {standalone.map((el) => (
              <button
                key={el.id}
                onClick={() => navigate(`/elements/${el.id}`)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-[18px] text-ink transition hover:bg-surface-2"
              >
                <FileText
                  size={17}
                  strokeWidth={2}
                  className="shrink-0 text-ink-4"
                />
                <span className="truncate">{el.name || 'Sans titre'}</span>
              </button>
            ))}
          </div>
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

  return (
    <button
      onClick={onNavigate}
      style={{ backgroundColor: colors.bg, color: colors.text }}
      className="group flex cursor-pointer flex-col rounded-2xl p-7 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_34px_-14px_rgba(0,0,0,0.4)]"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <FolderClosed size={19} strokeWidth={2.25} className="shrink-0" />
        <span className="title-display truncate text-[26px]">
          {group.name || 'Sans titre'}
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
              {child.name || 'Sans titre'}
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
            <span className="truncate">{el.name || 'Sans titre'}</span>
            <span className="ml-2 shrink-0 text-[14px] text-ink-4">
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
