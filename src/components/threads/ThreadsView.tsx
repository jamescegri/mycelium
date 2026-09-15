import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { displayName } from '../../lib/display';
import { isGroup, normalize, type ConnectionsIndex } from '../../lib/connections';
import { linkCitation } from '../../lib/connectionWrites';
import { reportError } from '../../lib/errors';
import { pastelFor } from '../../lib/palette';
import {
  autoLevel,
  bandsFor,
  bestGroup,
  buildChart,
  buildThreadsModel,
  columnsFor,
  decodeSource,
  defaultSelection,
  encodeSource,
  orderRows,
  resolveFollowed,
  THREAD_LEVELS,
  type Cell,
  type CitationHit,
  type FollowSource,
  type ThreadLevel,
} from '../../lib/threads';
import { usePeek } from '../PeekPanel';
import { useConnectionsData } from '../connections/useConnectionsData';
import { truncate } from '../connections/kinds';
import { ThreadsChart, type HoverInfo } from './ThreadsChart';
import type { Tag } from '../../types';

const LEVEL_LABEL: Record<ThreadLevel, string> = { scenes: 'Scènes', chapitres: 'Chapitres', tomes: 'Tomes' };

// Les Elements cochés sont une préférence de lecture, propre à ce
// navigateur : ils ne vont pas en base.
const STORAGE_KEY = 'mycelium.fils.selection';
function readSelections(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string[]>;
  } catch {
    return {};
  }
}
function writeSelections(value: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Navigation privée ou stockage bloqué : la sélection reste pour la session.
  }
}

// ─────────────────────────────────────────────────────────────────────
// Fils — troisième lecture de la chronologie : suivre des Elements au fil
// de l'histoire. Ce qu'on suit et le niveau de lecture vivent dans
// l'adresse (`?vue=fils&suivre=…&niveau=…`).
// ─────────────────────────────────────────────────────────────────────
export function ThreadsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openPeek } = usePeek();
  const [params, setParams] = useSearchParams();
  const { index, tags, elementTags, temporal, isLoading } = useConnectionsData();

  const fallbackGroup = useMemo(() => bestGroup(index), [index]);
  const sourceParam = params.get('suivre');
  const sourceKey = decodeSource(sourceParam) ? sourceParam! : fallbackGroup ? `g:${fallbackGroup}` : '';
  const source = useMemo(() => decodeSource(sourceKey), [sourceKey]);

  const followed = useMemo(
    () => (source ? resolveFollowed(source, index, elementTags) : []),
    [source, index, elementTags]
  );
  const model = useMemo(() => buildThreadsModel(index, temporal, followed), [index, temporal, followed]);

  // Sur téléphone, 4 lignes tiennent sans défiler de côté ; ailleurs, 10.
  const [narrowScreen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  const [stored, setStored] = useState(readSelections);
  const present = useMemo(() => model.followed.filter((id) => model.hits.has(id)), [model]);
  const baseline = useMemo(() => defaultSelection(model, narrowScreen ? 4 : 10), [model, narrowScreen]);
  const selected = useMemo(() => {
    const saved = stored[sourceKey]?.filter((id) => model.hits.has(id));
    return saved?.length ? saved : baseline;
  }, [stored, sourceKey, model, baseline]);

  const setSelected = (ids: string[]) =>
    setStored((prev) => {
      const next = { ...prev, [sourceKey]: ids };
      writeSelections(next);
      return next;
    });
  // Pas de plafond : on coche autant d'Elements qu'on veut. On garde
  // seulement au moins une ligne, sans quoi il n'y aurait rien à lire.
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length > 1) setSelected(selected.filter((x) => x !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const levelParam = params.get('niveau') as ThreadLevel | null;
  const level = levelParam && THREAD_LEVELS.includes(levelParam) ? levelParam : autoLevel(model);
  const columns = useMemo(() => columnsFor(model, level), [model, level]);
  const bands = useMemo(() => bandsFor(model, columns, level), [model, columns, level]);
  const rowIds = useMemo(() => orderRows(model, selected), [model, selected]);
  const chart = useMemo(() => buildChart(model, columns, rowIds), [model, columns, rowIds]);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const focusedRow = selectedRow && rowIds.includes(selectedRow) ? selectedRow : null;

  const setParam = (key: string, value: string | null, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace }
    );

  const citationMutation = useMutation({
    mutationFn: (citation: CitationHit) => linkCitation(index, citation.elementId, citation.sourceId),
    onSuccess: (_result, citation) => {
      queryClient.invalidateQueries({ queryKey: ['relations'] });
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', citation.sourceId] });
      queryClient.invalidateQueries({ queryKey: ['backlinks', citation.elementId] });
    },
    onError: reportError,
  });

  const name = (id: string) => {
    const el = index.byId.get(id);
    return el ? displayName(el) : '';
  };

  // Un point ouvre ce qu'il désigne, sans quitter la chronologie : la scène
  // à ce niveau, sinon l'ensemble qui la contient.
  const openCell = (_rowId: string, cell: Cell, col: number) => {
    const target = level === 'scenes' ? (cell.hits[0]?.sourceId ?? cell.citations[0]?.sourceId) : columns[col]?.key;
    if (target) openPeek(target);
  };

  const changeSource = (next: FollowSource | null) => {
    setSelectedRow(null);
    setHover(null);
    setShowOthers(false);
    setParam('suivre', next ? encodeSource(next) : null);
  };

  if (isLoading) return <p className="text-[15px] text-ink-3">Chargement…</p>;

  if (model.moments.length === 0) {
    return (
      <Note>
        Fils suit des Elements le long de ta chronologie, qui est encore vide. Situe un arc ou un chapitre dans le
        temps, puis mentionne tes Elements avec « / » dans ses scènes.
      </Note>
    );
  }

  // Les puces visibles : la sélection par défaut et tout ce qui est coché.
  // Décocher garde la puce en place ; le reste attend derrière « Voir les
  // autres », sans limite.
  const shown = orderRows(model, [...new Set([...baseline, ...selected])]);
  const others = orderRows(model, present).filter((id) => !shown.includes(id));

  return (
    <div>
      <SourcePicker index={index} tags={tags} source={source} onChange={changeSource} />

      {!source ? (
        <Note>Choisis un Groupe, un tag ou quelques Elements à suivre le long de l'histoire.</Note>
      ) : (
        <>
          {present.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-1.5">
              {[...shown, ...(showOthers ? others : [])].map((id) => (
                <FollowChip key={id} id={id} label={name(id)} checked={selected.includes(id)} onToggle={() => toggle(id)} />
              ))}
              {others.length > 0 && (
                <button
                  onClick={() => setShowOthers((v) => !v)}
                  className="rounded-lg px-2.5 py-1 text-[14px] text-ink-3 underline decoration-line underline-offset-[3px] transition hover:text-ink hover:decoration-ink-4"
                >
                  {showOthers ? 'Masquer les autres' : 'Voir les autres'}
                </button>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2 text-[14px]">
            <span className="mr-1.5 text-ink-4">Lire par</span>
            {THREAD_LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setParam('niveau', l, true)}
                aria-pressed={level === l}
                className={`rounded-lg px-2 py-1 transition hover:bg-surface-2 hover:text-ink ${
                  level === l ? 'font-semibold text-ink' : 'text-ink-3'
                }`}
              >
                {LEVEL_LABEL[l]}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-line-soft pt-5">
            {rowIds.length === 0 ? (
              <Note>
                Aucun de ces Elements n'est encore mentionné dans la chronologie. Mentionne-les avec « / » dans le
                texte des scènes où ils apparaissent.
              </Note>
            ) : (
              <ThreadsChart
                index={index}
                level={level}
                columns={columns}
                bands={bands}
                rows={chart.rows}
                encounters={chart.encounters}
                selectedId={focusedRow}
                onSelect={(id) => {
                  // La légende d'un point survolé cède la place aux actions
                  // de la ligne choisie.
                  setHover(null);
                  setSelectedRow(id);
                }}
                onHover={setHover}
                onOpenCell={openCell}
              />
            )}
          </div>

          {/* Ce que dit le point survolé, ou ce qu'on peut faire de la ligne
              mise en avant. */}
          {rowIds.length > 0 && (
            <div className="flex min-h-[64px] flex-col justify-start gap-1 pt-3 text-[14.5px] text-ink-3" aria-live="polite">
              {hover ? (
                <HoverCaption hover={hover} rows={chart.rows} name={name} columnKey={columns[hover.col]?.key} />
              ) : focusedRow ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong className="font-semibold text-ink">{name(focusedRow)}</strong>
                  <span>
                    de « {name(model.moments[model.hits.get(focusedRow)![0].first].id)} » à « {name(model.moments[Math.max(...model.hits.get(focusedRow)!.map((h) => h.last))].id)} »
                  </span>
                  <button onClick={() => openPeek(focusedRow)} className="rounded-lg px-2 py-0.5 text-ink-2 transition hover:bg-surface-2 hover:text-ink">
                    Ouvrir
                  </button>
                  <button onClick={() => navigate(`/connexions?autour=${focusedRow}`)} className="rounded-lg px-2 py-0.5 text-ink-2 transition hover:bg-surface-2 hover:text-ink">
                    Explorer ses connexions
                  </button>
                  <button onClick={() => setSelectedRow(null)} className="rounded-lg px-2 py-0.5 text-ink-4 transition hover:bg-surface-2 hover:text-ink">
                    Tout afficher
                  </button>
                </span>
              ) : (
                <span className="text-[13.5px] text-ink-4">
                  ● présent · │ ensemble dans le même moment · ┄ longue absence · ○ cité sans lien — clique un nom
                  pour suivre sa ligne, un point pour ouvrir le moment.
                </span>
              )}
            </div>
          )}

          {model.never.length > 0 && (
            <section className="mt-6">
              <p className="mb-1 text-[13px] text-ink-4">Jamais mentionnés</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {model.never.map((id) => (
                  <button key={id} onClick={() => openPeek(id)} className="text-[14.5px] text-ink-2 transition hover:text-ink">
                    {name(id)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {model.citations.length > 0 && (
            <section className="mt-6">
              <p className="mb-0.5 text-[13px] text-ink-4">Cités sans lien</p>
              <p className="mb-1 text-[13px] text-ink-4">
                Leur nom est écrit dans ces moments, sans « / ». Relier transforme l'occurrence en mention.
              </p>
              <div>
                {model.citations.map((citation) => {
                  const busy =
                    citationMutation.isPending &&
                    citationMutation.variables?.sourceId === citation.sourceId &&
                    citationMutation.variables?.elementId === citation.elementId;
                  return (
                    <div
                      key={`${citation.elementId}-${citation.sourceId}`}
                      className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-xl px-3 py-1.5 transition hover:bg-surface-2"
                    >
                      <button
                        onClick={() => openPeek(citation.sourceId)}
                        className="flex min-w-0 flex-1 items-baseline gap-2 py-1 text-left max-md:flex-wrap"
                      >
                        <span className="shrink-0 text-[15px]">{name(citation.elementId)}</span>
                        <span className="shrink-0 text-[14px] text-ink-4">dans « {truncate(name(citation.sourceId), 30)} »</span>
                        <span className="min-w-0 truncate text-[14px] text-ink-3 max-md:basis-full max-md:whitespace-normal">
                          « {citation.quote} »
                        </span>
                      </button>
                      <button
                        onClick={() => citationMutation.mutate(citation)}
                        disabled={citationMutation.isPending}
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-[14px] text-ink-2 transition hover:bg-surface-3 hover:text-ink disabled:opacity-50"
                      >
                        {busy ? 'Relier…' : 'Relier'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[58ch] text-[15px] text-ink-3">{children}</p>;
}

function FollowChip({ id, label, checked, onToggle }: { id: string; label: string; checked: boolean; onToggle: () => void }) {
  const tone = pastelFor(id).ring;
  return (
    <button
      onClick={onToggle}
      aria-pressed={checked}
      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[14px] transition hover:bg-surface-2 ${
        checked ? 'text-ink' : 'text-ink-4'
      }`}
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={checked ? { background: tone } : { boxShadow: `inset 0 0 0 1.5px ${tone}` }}
      />
      {label}
    </button>
  );
}

function HoverCaption({
  hover,
  rows,
  name,
  columnKey,
}: {
  hover: HoverInfo;
  rows: { id: string; cells: Cell[] }[];
  name: (id: string) => string;
  columnKey: string | undefined;
}) {
  const hit = hover.cell.hits[0];
  if (!hit) {
    const citation = hover.cell.citations[0];
    return (
      <>
        <span>
          <strong className="font-semibold text-ink">{name(hover.rowId)}</strong> est cité sans lien dans «{' '}
          {name(citation.sourceId)} » — Relier plus bas pour l'ajouter au fil.
        </span>
        <span className="text-[13.5px] text-ink-4">« {citation.quote} »</span>
      </>
    );
  }
  const together = rows.filter((row) => row.cells.some((c) => c.col === hover.col && c.hits.length)).map((row) => name(row.id));
  const count = hover.cell.hits.reduce((n, h) => n + h.count, 0);
  const place = hover.cell.hits.length > 1 && columnKey ? name(columnKey) : name(hit.sourceId);
  return (
    <>
      <span>
        <strong className="font-semibold text-ink">« {place} »</strong> — {together.join(', ')}
        {count > 1 && <span className="text-ink-4"> · {name(hover.rowId)} mentionné {count} fois</span>}
      </span>
      {hit.quote && <span className="text-[13.5px] text-ink-4">« {hit.quote} »</span>}
    </>
  );
}

// Suivre un Groupe, un tag, ou quelques Elements choisis à la main. Un seul
// champ : les résultats sont rangés par ce qu'ils permettent de suivre.
function SourcePicker({
  index,
  tags,
  source,
  onChange,
}: {
  index: ConnectionsIndex;
  tags: Tag[];
  source: FollowSource | null;
  onChange: (source: FollowSource | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const q = normalize(query.trim());
  const options = useMemo(() => {
    if (!q) return [] as { kind: 'group' | 'tag' | 'element'; id: string; label: string }[];
    const byName = (label: string) => normalize(label).includes(q);
    const groups = index.elements
      .filter((e) => isGroup(index, e.id) && byName(displayName(e)))
      .slice(0, 5)
      .map((e) => ({ kind: 'group' as const, id: e.id, label: displayName(e) }));
    const tagOptions = tags.filter((t) => byName(t.name)).slice(0, 4).map((t) => ({ kind: 'tag' as const, id: t.id, label: t.name }));
    const elements = index.elements
      .filter((e) => byName(displayName(e)))
      .slice(0, 5)
      .map((e) => ({ kind: 'element' as const, id: e.id, label: displayName(e) }));
    return [...groups, ...tagOptions, ...elements];
  }, [q, index, tags]);

  const choose = (option: { kind: 'group' | 'tag' | 'element'; id: string }) => {
    setQuery('');
    setOpen(false);
    if (option.kind === 'group') onChange({ kind: 'group', id: option.id });
    else if (option.kind === 'tag') onChange({ kind: 'tag', id: option.id });
    else {
      const ids = source?.kind === 'custom' ? [...new Set([...source.ids, option.id])] : [option.id];
      onChange({ kind: 'custom', ids });
    }
  };

  const nameOf = (id: string) => {
    const el = index.byId.get(id);
    return el ? displayName(el) : '';
  };
  const current =
    source?.kind === 'group'
      ? nameOf(source.id)
      : source?.kind === 'tag'
        ? `le tag ${tags.find((t) => t.id === source.id)?.name ?? ''}`
        : source?.kind === 'custom'
          ? source.ids.map(nameOf).filter(Boolean).join(', ')
          : null;

  const SECTION: Record<string, string> = { group: 'Groupes', tag: 'Tags', element: 'Choisir des Elements' };

  return (
    <div className="grid max-w-[48rem] grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2 max-md:grid-cols-1">
      <span className="text-[15px] text-ink-3">Suivre</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {current && (
          <span className="flex min-w-0 items-center gap-1.5 text-[16px]">
            <strong className="truncate font-semibold text-ink">{current}</strong>
            {source?.kind !== 'group' && (
              <button
                onClick={() => onChange(null)}
                aria-label="Revenir au Groupe proposé"
                className="grid size-6 shrink-0 place-items-center rounded-md text-ink-4 transition hover:bg-surface-2 hover:text-ink"
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            )}
          </span>
        )}
        <div className="relative min-w-[14rem] flex-1">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && options[active]) {
                e.preventDefault();
                choose(options[active]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={source?.kind === 'custom' ? 'Ajouter un Element, ou suivre un Groupe…' : 'Un Groupe, un tag, ou des Elements…'}
            aria-label="Choisir ce qu'on suit"
            autoComplete="off"
            className="w-full border-b border-line bg-transparent py-1.5 text-[15px] text-ink outline-none transition placeholder:text-ink-4 focus:border-ink-4"
          />
          {open && options.length > 0 && (
            <div className="animate-page-in absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-line-soft bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.18)]">
              {options.map((option, i) => (
                <div key={`${option.kind}-${option.id}`}>
                  {(i === 0 || options[i - 1].kind !== option.kind) && (
                    <p className="px-2.5 pt-2 pb-1 text-[12px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                      {SECTION[option.kind]}
                    </p>
                  )}
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(option);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[14.5px] transition ${
                      i === active ? 'bg-surface-2' : 'hover:bg-surface-2'
                    }`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={
                        option.kind === 'group'
                          ? { background: pastelFor(option.id).bg }
                          : { boxShadow: `inset 0 0 0 2px ${pastelFor(option.id).bg}` }
                      }
                    />
                    <span className="truncate">{option.label}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
