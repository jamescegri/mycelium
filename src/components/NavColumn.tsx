import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, Plus, Search } from 'lucide-react';
import { createElement, listElements } from '../lib/elements';
import { childrenOf, hasChildren, listAllLinks, parentsOf } from '../lib/links';
import { listAllElementTags, listAllTags } from '../lib/tags';
import { listTemporalRelations } from '../lib/temporal';
import { chronologyOrder } from '../lib/chronology';
import { displayName } from '../lib/display';
import { pastelFor } from '../lib/palette';
import { useCommandPalette } from './CommandPalette';
import { CaptureBar } from './CaptureBar';
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

// `wide` : tant qu'aucun Element n'est ouvert, la colonne prend toute la
// place — on est en train d'explorer, autant le faire au large. Elle se
// resserre dès qu'il y a quelque chose à lire à côté.
export function NavColumn({ wide = false }: { wide?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { open: openPalette } = useCommandPalette();
  const [filter, setFilter] = useState('');

  const panel = panelFor(location.pathname);

  const createMutation = useMutation({
    mutationFn: () => createElement({ name: '' }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  return (
    <div
      className={`flex min-h-0 flex-col border-r border-line-soft ${
        wide ? 'w-full max-w-[52rem]' : 'w-[300px] shrink-0'
      }`}
    >
      <div className="px-4 pt-5 pb-3">
        <button
          onClick={openPalette}
          className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-left text-[14.5px] text-ink-3 transition hover:border-ink-4"
        >
          <Search size={15} strokeWidth={2} className="shrink-0" />
          Rechercher
          <span className="ml-auto text-[12.5px] text-ink-4">⌘K</span>
        </button>
      </div>

      {/* Au large, on a la place d'écrire une idée sans quitter
          l'exploration — c'est le geste le plus fréquent de l'app. */}
      {wide && (
        <div className="px-4 pb-4">
          <CaptureBar />
        </div>
      )}

      <div className="px-4 pb-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer cette liste…"
          className="w-full border-b border-line bg-transparent pb-2 text-[14px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {panel === 'groupes' && <GroupesPanel filter={filter} wide={wide} />}
        {panel === 'tags' && <TagsPanel filter={filter} />}
        {panel === 'chronologie' && <ChronologiePanel filter={filter} />}
      </div>

      {/* Au large, la barre de capture couvre déjà la création : deux
          boutons pour le même geste feraient hésiter. */}
      {!wide && (
        <div className="border-t border-line-soft px-4 py-4">
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2.5} />
            Créer
          </button>
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
  return <p className="px-1.5 text-[14px] text-ink-4">{children}</p>;
}

// ── Groupes ──────────────────────────────────────────────────────────
// Un explorateur, pas une liste de raccourcis : entrer dans un Groupe
// descend d'un cran ici même, comme dans un Finder, au lieu d'ouvrir une
// page. On ne change de colonne qu'une fois arrivé sur l'Element qu'on
// cherchait — c'est lui qu'on voulait lire, pas les dossiers traversés.
//
// Un Groupe n'est pas une entité : c'est un Element qui a des enfants.
// Descendre dedans et l'ouvrir sont donc deux gestes distincts, d'où le
// bouton "Ouvrir" du fil d'Ariane : il a un texte, comme tous les autres.
function GroupesPanel({ filter, wide }: { filter: string; wide: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [path, setPath] = useState<Element[]>([]);

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });

  const here = path[path.length - 1] ?? null;

  const items = useMemo(() => {
    const all = elements ?? [];
    const ls = links ?? [];
    const list = here
      ? childrenOf(ls, all, here.id)
      : all.filter(
          (e) => hasChildren(ls, e.id) && parentsOf(ls, all, e.id).length === 0
        );
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => displayName(e).toLowerCase().includes(q));
  }, [elements, links, here, filter]);

  return (
    <>
      {here ? (
        <div className="mb-3 flex items-center gap-1.5 px-1.5">
          <button
            onClick={() => setPath((p) => p.slice(0, -1))}
            className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft size={14} strokeWidth={2.2} />
            {path.length > 1 ? displayName(path[path.length - 2]) : 'Groupes'}
          </button>
          <span className="truncate text-[13px] font-semibold">
            {displayName(here)}
          </span>
          <button
            onClick={() => navigate(`/elements/${here.id}`)}
            className="ml-auto shrink-0 rounded-lg px-2 py-1 text-[12.5px] text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            Ouvrir
          </button>
        </div>
      ) : (
        <PanelTitle>Groupes</PanelTitle>
      )}

      {items.length === 0 ? (
        <EmptyPanel>
          {here
            ? 'Ce Groupe est vide.'
            : "Rattache un enfant à un Element pour qu'il devienne un Groupe."}
        </EmptyPanel>
      ) : (
        <div
          className={
            wide
              ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2'
              : 'flex flex-col gap-1.5'
          }
        >
          {items.map((item) => (
            <GroupNavCard
              key={item.id}
              group={item}
              elements={elements ?? []}
              links={links ?? []}
              active={location.pathname === `/elements/${item.id}`}
              onEnter={() => setPath((p) => [...p, item])}
              onOpen={() => navigate(`/elements/${item.id}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GroupNavCard({
  group,
  elements,
  links,
  active,
  onEnter,
  onOpen,
}: {
  group: Element;
  elements: Element[];
  links: ElementLink[];
  active: boolean;
  onEnter: () => void;
  onOpen: () => void;
}) {
  const children = childrenOf(links, elements, group.id);
  const isGroup = children.length > 0;
  const shown = children.slice(0, 4);
  const rest = children.length - shown.length;
  const tone = pastelFor(group.id);

  return (
    <button
      onClick={isGroup ? onEnter : onOpen}
      aria-current={active ? 'true' : undefined}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? 'border-ink shadow-[0_0_0_1px_var(--color-ink)]'
          : 'border-line hover:border-ink-4'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: tone.bg }}
        />
        <span className="truncate text-[14.5px] font-semibold">
          {displayName(group)}
        </span>
        {isGroup ? (
          <>
            <span className="ml-auto shrink-0 text-[12px] tabular-nums text-ink-4">
              {children.length}
            </span>
            <ChevronRight
              size={14}
              strokeWidth={2.2}
              className="shrink-0 text-ink-4"
            />
          </>
        ) : (
          <FileText
            size={13}
            strokeWidth={2}
            className="ml-auto shrink-0 text-ink-4"
          />
        )}
      </span>

      {/* Les pastilles passent à la ligne et le reste se replie dans un
          +n : une rangée coupée cacherait des enfants sans le dire. */}
      {isGroup && (
        <span className="mt-2 flex flex-wrap gap-1">
          {shown.map((child) => {
            const t = pastelFor(child.id);
            return (
              <span
                key={child.id}
                className="max-w-full truncate rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                style={{ backgroundColor: t.bg, color: t.text }}
              >
                {displayName(child)}
              </span>
            );
          })}
          {rest > 0 && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11.5px] text-ink-3">
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
function ChronologiePanel({ filter }: { filter: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: relations } = useQuery({
    queryKey: ['temporal'],
    queryFn: listTemporalRelations,
  });

  const ordered = useMemo(() => {
    const all = chronologyOrder(elements ?? [], relations ?? []);
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => displayName(e).toLowerCase().includes(q));
  }, [elements, relations, filter]);

  if (ordered.length === 0) {
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
        {ordered.map((el, i) => {
          const tone = pastelFor(el.id);
          const active = location.pathname === `/elements/${el.id}`;
          return (
            <button
              key={el.id}
              onClick={() => navigate(`/elements/${el.id}`)}
              aria-current={active ? 'true' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] transition ${
                active ? 'bg-surface-3 font-semibold' : 'hover:bg-surface-2'
              }`}
            >
              <span className="w-4 shrink-0 text-[11.5px] tabular-nums text-ink-4">
                {i + 1}
              </span>
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: tone.bg }}
              />
              <span className="truncate">{displayName(el)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
