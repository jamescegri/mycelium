import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Plus } from 'lucide-react';
import { createElement, listElements } from '../lib/elements';
import { listAllLinks, moveChild } from '../lib/links';
import { listAllRelations } from '../lib/relations';
import { listTemporalRelations } from '../lib/temporal';
import {
  placeInChronology,
  timelineRows,
  type TimelineRow,
} from '../lib/chronology';
import { displayName } from '../lib/display';
import { pastelFor } from '../lib/palette';
import { reportError } from '../lib/errors';
import type { Element } from '../types';

// La chronologie telle qu'on la parcourt : le récit emboîté, lu dans
// l'ordre. Rien ici ne demande "de quel type est cet Element ?" — un
// chapitre n'est qu'un Element qui se trouve contenir des scènes.
//
// Deux gestes, et deux seulement : glisser pour déplacer, cliquer un
// interstice pour créer au bon endroit. Les deux passent par `moveChild`,
// donc l'ordre ne peut pas diverger entre "créer" et "déplacer".

const INDENT = 22;

type Item =
  | { kind: 'row'; row: TimelineRow }
  // Un interstice entre deux frères : y créer ou y déposer insère à cette
  // place exactement.
  | { kind: 'slot'; parentId: string | null; index: number; depth: number }
  // La fin d'un groupe : ajoute en dernier, à l'intérieur.
  | { kind: 'end'; parentId: string; index: number; depth: number };

// Les lignes plates deviennent une suite d'items où chaque emplacement
// libre est matérialisé. On ferme un groupe dès qu'on rencontre une ligne
// moins profonde : c'est là que se glisse son "ajouter à la fin".
function toItems(rows: TimelineRow[]): Item[] {
  const items: Item[] = [];
  const open: TimelineRow[] = [];

  const closeDownTo = (depth: number) => {
    while (open.length > 0 && depth <= open[open.length - 1].depth) {
      const closed = open.pop() as TimelineRow;
      items.push({
        kind: 'end',
        parentId: closed.element.id,
        index: closed.childCount,
        depth: closed.depth + 1,
      });
    }
  };

  for (const row of rows) {
    closeDownTo(row.depth);
    items.push({
      kind: 'slot',
      parentId: row.parentId,
      index: row.index,
      depth: row.depth,
    });
    items.push({ kind: 'row', row });
    if (row.childCount > 0) open.push(row);
  }

  closeDownTo(-1);
  return items;
}

export function TimelineTree() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dragged, setDragged] = useState<TimelineRow | null>(null);
  const [creatingAt, setCreatingAt] = useState<string | null>(null);

  const { data: elements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: links } = useQuery({ queryKey: ['links'], queryFn: listAllLinks });
  const { data: temporal } = useQuery({
    queryKey: ['temporal-relations'],
    queryFn: listTemporalRelations,
  });
  const { data: relations } = useQuery({
    queryKey: ['relations'],
    queryFn: listAllRelations,
  });

  const all = elements ?? [];
  const allLinks = links ?? [];

  const rows = useMemo(
    () => timelineRows(all, allLinks, temporal ?? []),
    [all, allLinks, temporal]
  );
  const items = useMemo(() => toItems(rows), [rows]);

  // Ce à quoi chaque Element est relié, quelle que soit sa place dans le
  // récit : c'est ce qui fait de la chronologie une porte d'entrée vers le
  // reste, et pas une liste close sur elle-même.
  const connectionsOf = useMemo(() => {
    const byId = new Map(all.map((e) => [e.id, e]));
    const map = new Map<string, Element[]>();
    for (const r of relations ?? []) {
      for (const [from, to] of [
        [r.source_id, r.target_id],
        [r.target_id, r.source_id],
      ]) {
        const other = byId.get(to);
        if (!other) continue;
        const list = map.get(from) ?? [];
        if (!list.some((e) => e.id === other.id)) list.push(other);
        map.set(from, list);
      }
    }
    return map;
  }, [relations, all]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['links'] });
    queryClient.invalidateQueries({ queryKey: ['elements'] });
    queryClient.invalidateQueries({ queryKey: ['temporal-relations'] });
  };

  // Les grandes entrées n'ont pas de parent pour porter leur ordre : elles
  // sont les seules à rester rangées par `temporal_relations`. Partout
  // ailleurs, c'est la position dans le parent qui fait foi.
  const roots = useMemo(
    () => rows.filter((r) => r.parentId === null).map((r) => r.element),
    [rows]
  );

  async function situate(
    elementId: string,
    fromParentId: string | null,
    toParentId: string | null,
    index: number
  ) {
    if (toParentId) {
      await moveChild(allLinks, all, elementId, fromParentId, toParentId, index);
      return;
    }
    if (fromParentId) await moveChild(allLinks, all, elementId, fromParentId, null, 0);
    const others = roots.filter((r) => r.id !== elementId);
    await placeInChronology(
      temporal ?? [],
      elementId,
      others[index - 1]?.id ?? null,
      others[index]?.id ?? null
    );
  }

  const moveMutation = useMutation({
    mutationFn: ({
      row,
      toParentId,
      index,
    }: {
      row: TimelineRow;
      toParentId: string | null;
      index: number;
    }) => situate(row.element.id, row.parentId, toParentId, index),
    onSuccess: invalidate,
    onError: reportError,
  });

  // Créer et situer sont une seule action : l'Element naît déjà à sa place.
  const createMutation = useMutation({
    mutationFn: async ({
      name,
      parentId,
      index,
    }: {
      name: string;
      parentId: string | null;
      index: number;
    }) => {
      const created = await createElement({ name, timeline: true });
      await situate(created.id, null, parentId, index);
    },
    onSuccess: () => {
      setCreatingAt(null);
      invalidate();
    },
    onError: reportError,
  });

  function drop(parentId: string | null, index: number) {
    if (!dragged) return;
    // Se déposer dans sa propre descendance n'a pas de sens ; `moveChild`
    // le refuse aussi côté données, mais autant ne pas le proposer.
    moveMutation.mutate({ row: dragged, toParentId: parentId, index });
    setDragged(null);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line px-6 py-8">
        <p className="mb-1 text-[17px] font-semibold">
          Ta chronologie est vide.
        </p>
        <p className="mb-5 max-w-[56ch] text-[15.5px] text-ink-3">
          Commence par une grande entrée — un arc, un tome. Tu y rangeras
          ensuite des chapitres, puis des scènes : ce sont des Elements
          ordinaires, c'est leur ordre ici qui raconte.
        </p>
        <NewEntry
          open={creatingAt === 'root'}
          onOpen={() => setCreatingAt('root')}
          onCancel={() => setCreatingAt(null)}
          onCreate={(name) =>
            createMutation.mutate({ name, parentId: null, index: 0 })
          }
          label="Commencer la chronologie"
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      {items.map((item, i) => {
        if (item.kind === 'row') {
          const { row } = item;
          const connections = connectionsOf.get(row.element.id) ?? [];
          return (
            <TimelineEntry
              key={`row-${row.element.id}-${i}`}
              row={row}
              connections={connections}
              dimmed={dragged?.element.id === row.element.id}
              onDragStart={() => setDragged(row)}
              onDragEnd={() => setDragged(null)}
              onOpen={() => navigate(`/elements/${row.element.id}`)}
              onOpenConnection={(id) => navigate(`/elements/${id}`)}
            />
          );
        }

        const key = `${item.kind}-${item.parentId ?? 'root'}-${item.index}`;
        return (
          <Gap
            key={key}
            depth={item.depth}
            atEnd={item.kind === 'end'}
            armed={dragged !== null}
            creating={creatingAt === key}
            onCreateOpen={() => setCreatingAt(key)}
            onCreateCancel={() => setCreatingAt(null)}
            onCreate={(name) =>
              createMutation.mutate({
                name,
                parentId: item.parentId,
                index: item.index,
              })
            }
            onDrop={() => drop(item.parentId, item.index)}
          />
        );
      })}
    </div>
  );
}

function TimelineEntry({
  row,
  connections,
  dimmed,
  onDragStart,
  onDragEnd,
  onOpen,
  onOpenConnection,
}: {
  row: TimelineRow;
  connections: Element[];
  dimmed: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onOpenConnection: (id: string) => void;
}) {
  const tone = pastelFor(row.element.id);
  const shown = connections.slice(0, 3);
  const rest = connections.length - shown.length;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ marginLeft: row.depth * INDENT }}
      className={`group flex cursor-grab items-start gap-2.5 rounded-xl px-2 py-2 transition active:cursor-grabbing ${
        dimmed ? 'opacity-35' : 'hover:bg-surface-2'
      }`}
    >
      <GripVertical
        size={15}
        strokeWidth={2}
        className="mt-1 shrink-0 text-ink-4 opacity-0 transition group-hover:opacity-100"
      />

      {/* La pastille dit la profondeur sans qu'on ait à compter : pleine
          pour une grande entrée, creuse pour une scène. */}
      <span
        className="mt-[7px] size-2.5 shrink-0 rounded-[3px]"
        style={
          row.childCount > 0
            ? { backgroundColor: tone.bg }
            : { boxShadow: `inset 0 0 0 2px ${tone.bg}` }
        }
      />

      <div className="min-w-0 flex-1">
        <button
          onClick={onOpen}
          className={`block max-w-full truncate text-left ${
            row.depth === 0
              ? 'text-[19px] font-semibold'
              : row.childCount > 0
                ? 'text-[16.5px] font-medium'
                : 'text-[16px]'
          }`}
        >
          {displayName(row.element)}
        </button>

        {shown.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {shown.map((c) => {
              const t = pastelFor(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenConnection(c.id)}
                  className="max-w-[12rem] truncate rounded-full px-2 py-0.5 text-[11.5px] font-medium transition hover:opacity-80"
                  style={{ backgroundColor: t.bg, color: t.text }}
                >
                  {displayName(c)}
                </button>
              );
            })}
            {rest > 0 && (
              <span className="text-[11.5px] text-ink-4">+{rest}</span>
            )}
          </div>
        )}
      </div>

      {row.childCount > 0 && (
        <span className="mt-1 shrink-0 text-[12px] tabular-nums text-ink-4">
          {row.childCount}
        </span>
      )}
    </div>
  );
}

// Un emplacement libre. Invisible au repos — sinon la chronologie se lirait
// comme un formulaire — et il ne s'ouvre qu'au survol, ou dès qu'un glisser
// commence : une cible qui n'apparaît qu'au dernier moment est impossible à
// viser.
function Gap({
  depth,
  atEnd,
  armed,
  creating,
  onCreateOpen,
  onCreateCancel,
  onCreate,
  onDrop,
}: {
  depth: number;
  atEnd: boolean;
  armed: boolean;
  creating: boolean;
  onCreateOpen: () => void;
  onCreateCancel: () => void;
  onCreate: (name: string) => void;
  onDrop: () => void;
}) {
  const [over, setOver] = useState(false);
  const [name, setName] = useState('');

  if (creating) {
    return (
      <form
        style={{ marginLeft: depth * INDENT + 30 }}
        className="flex items-center gap-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim());
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !name.trim() && onCreateCancel()}
          onKeyDown={(e) => e.key === 'Escape' && onCreateCancel()}
          placeholder={atEnd ? 'Ajouter ici…' : 'Insérer ici…'}
          className="min-w-0 flex-1 border-b border-ink bg-transparent py-1 text-[15.5px] outline-none placeholder:text-ink-4"
        />
        <button type="submit" className="shrink-0 text-[13.5px] font-semibold">
          Créer
        </button>
      </form>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop();
      }}
      style={{ marginLeft: depth * INDENT + 30 }}
      className={`group flex items-center transition-all ${
        armed ? 'h-6' : 'h-2.5'
      }`}
    >
      <button
        onClick={onCreateOpen}
        className={`flex flex-1 items-center gap-2 text-left transition ${
          over ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        <Plus size={12} strokeWidth={2.6} className="shrink-0 text-ink-3" />
        <span
          className={`h-px flex-1 ${over ? 'bg-ink' : 'bg-line'}`}
          aria-hidden
        />
        <span className="shrink-0 text-[11.5px] text-ink-3">
          {armed ? 'Déposer ici' : atEnd ? 'Ajouter ici' : 'Insérer ici'}
        </span>
      </button>
    </div>
  );
}

function NewEntry({
  open,
  onOpen,
  onCancel,
  onCreate,
  label,
}: {
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onCreate: (name: string) => void;
  label: string;
}) {
  const [name, setName] = useState('');

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-accent-hover"
      >
        <Plus size={16} strokeWidth={2.5} />
        {label}
      </button>
    );
  }

  return (
    <form
      className="flex max-w-[26rem] items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate(name.trim());
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && onCancel()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        placeholder="Nom de cette entrée…"
        className="min-w-0 flex-1 border-b border-ink bg-transparent py-1.5 text-[16px] outline-none placeholder:text-ink-4"
      />
      <button type="submit" className="shrink-0 text-[14px] font-semibold">
        Créer
      </button>
    </form>
  );
}
