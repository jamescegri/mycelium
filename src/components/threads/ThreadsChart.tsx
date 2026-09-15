import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { displayName } from '../../lib/display';
import { pastelFor } from '../../lib/palette';
import type { ConnectionsIndex } from '../../lib/connections';
import type { Band, Cell, ChartRow, Column, Encounter, ThreadLevel } from '../../lib/threads';
import { LANE, layoutThreads, ROW_GUTTER } from '../../lib/threadsLayout';
import { truncate } from '../connections/kinds';

export interface HoverInfo {
  rowId: string;
  col: number;
  cell: Cell;
}

// Le graphique Fils : une rangée fixe par Element, le temps en travers.
// Présence en point plein, citation sans lien en point creux, rencontres en
// traits verticaux, longues absences en pointillé. Tout est cliquable :
// un nom met sa ligne en avant, un point ouvre le moment.
export function ThreadsChart({
  index,
  level,
  columns,
  bands,
  rows,
  encounters,
  selectedId,
  onSelect,
  onHover,
  onOpenCell,
}: {
  index: ConnectionsIndex;
  level: ThreadLevel;
  columns: Column[];
  bands: Band[];
  rows: ChartRow[];
  encounters: Encounter[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (info: HoverInfo | null) => void;
  onOpenCell: (rowId: string, cell: Cell, col: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(Math.round(el.clientWidth));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const geo = useMemo(
    () =>
      width
        ? layoutThreads({
            width,
            columns: columns.length,
            rows: rows.length,
            level,
            bandStarts: bands.map((b) => b.firstCol),
          })
        : null,
    [width, columns.length, rows.length, level, bands]
  );

  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [cursor, setCursor] = useState<{ row: number; col: number } | null>(null);

  // Changer de niveau garde la même partie du récit sous les yeux : on
  // retient le moment au bord gauche, et on y revient après le regroupement.
  const anchorMoment = useRef(0);
  const [bandIndex, setBandIndex] = useState(0);
  const horizontal = geo?.orientation === 'horizontal';

  function onScroll() {
    const el = scrollRef.current;
    if (!geo || !horizontal || !el || !columns.length) return;
    const col = Math.max(0, Math.min(columns.length - 1, Math.floor(el.scrollLeft / geo.colStep)));
    anchorMoment.current = columns[col].first;
    const bi = bands.findIndex((b) => b.firstCol <= col && col <= b.lastCol);
    if (bi >= 0 && bi !== bandIndex) setBandIndex(bi);
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!geo || geo.orientation !== 'horizontal' || !el) return;
    const col = columns.findIndex((c) => c.first <= anchorMoment.current && anchorMoment.current <= c.last);
    el.scrollLeft = col > 0 ? geo.colPos[col] - geo.colStep / 2 - 12 : 0;
  }, [columns, geo]);

  if (!geo) return <div ref={wrapRef} className="min-h-[120px]" />;

  const point = (r: number, c: number) =>
    horizontal ? { x: geo.colPos[c], y: geo.lanePos[r] } : { x: geo.lanePos[r], y: geo.colPos[c] };
  const cellAt = (r: number, c: number) => rows[r]?.cells.find((x) => x.col === c);
  const name = (id: string) => {
    const el = index.byId.get(id);
    return el ? displayName(el) : '';
  };

  const showHover = (r: number | null, c = 0) => {
    if (r === null) {
      setHoverCell(null);
      onHover(null);
      return;
    }
    setHoverCell({ row: r, col: c });
    const cell = cellAt(r, c);
    if (cell) onHover({ rowId: rows[r].id, col: c, cell });
  };

  // Au clavier : on se déplace de point en point le long d'une ligne, et
  // d'une ligne à l'autre en gardant à peu près le même moment.
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (!rows.length) return;
    const start = { row: 0, col: rows[0].cells[0]?.col ?? 0 };
    const cur = cursor ?? start;
    const colsOf = (r: number) => rows[r].cells.map((c) => c.col);
    const along = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    const across = horizontal ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    let next = cur;

    if (along.includes(e.key)) {
      const cols = colsOf(cur.row);
      const i = Math.max(0, cols.indexOf(cur.col));
      const j = e.key === along[1] ? Math.min(cols.length - 1, i + (cursor ? 1 : 0)) : Math.max(0, i - 1);
      next = { row: cur.row, col: cols[j] ?? cur.col };
    } else if (across.includes(e.key)) {
      const row = Math.max(0, Math.min(rows.length - 1, cur.row + (e.key === across[1] ? 1 : -1)));
      const cols = colsOf(row);
      const col = cols.reduce((best, c) => (Math.abs(c - cur.col) < Math.abs(best - cur.col) ? c : best), cols[0] ?? cur.col);
      next = { row, col };
    } else if (e.key === 'Enter') {
      const cell = cellAt(cur.row, cur.col);
      if (cell) onOpenCell(rows[cur.row].id, cell, cur.col);
      e.preventDefault();
      return;
    } else if (e.key === 'Escape') {
      onSelect(null);
      return;
    } else {
      return;
    }

    e.preventDefault();
    setCursor(next);
    showHover(next.row, next.col);
    const el = scrollRef.current;
    if (horizontal && el) {
      const x = geo!.colPos[next.col];
      if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40) {
        el.scrollTo({ left: x - el.clientWidth / 2, behavior: 'smooth' });
      }
    }
  }

  const overflow = horizontal && geo.width > width - ROW_GUTTER + 1;

  const jumpBand = (dir: 1 | -1) => {
    const target = bands[bandIndex + dir];
    const el = scrollRef.current;
    if (!target || !el) return;
    setBandIndex(bandIndex + dir);
    el.scrollTo({ left: geo.colPos[target.firstCol] - geo.colStep / 2 - 12, behavior: 'smooth' });
  };

  const chart = (
    <svg
      width={geo.width}
      height={geo.height}
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ink"
      tabIndex={0}
      role="group"
      aria-label="Présences le long de la chronologie. Flèches pour passer d'un point à l'autre, Entrée pour ouvrir le moment, Échap pour tout réafficher."
      onKeyDown={onKeyDown}
      onPointerLeave={() => showHover(null)}
    >
      {/* Le moment survolé, sur toute la hauteur des lignes. */}
      {hoverCell && (
        <rect
          x={horizontal ? geo.colPos[hoverCell.col] - geo.colStep / 2 : geo.timeGutter - 6}
          y={horizontal ? geo.header - 6 : geo.colPos[hoverCell.col] - geo.colStep / 2}
          width={horizontal ? geo.colStep : rows.length * geo.laneStep + 12}
          height={horizontal ? rows.length * geo.laneStep + 12 : geo.colStep}
          rx={8}
          fill="#f5f5f5"
        />
      )}

      {/* En-têtes des ensembles : chapitres au-dessus des scènes, etc. */}
      {bands.map((band) => {
        const edge = geo.colPos[band.firstCol] - geo.colStep / 2;
        const span = (band.lastCol - band.firstCol + 1) * geo.colStep;
        return horizontal ? (
          <g key={`${band.key}-${band.firstCol}`}>
            {band.firstCol > 0 && <line x1={edge} x2={edge} y1={4} y2={geo.height - 4} stroke="#efefef" strokeWidth={1.5} />}
            <text x={edge + 6} y={18} className="th-text th-band">
              {truncate(name(band.key), Math.max(4, Math.floor((span - 12) / 7.5)))}
            </text>
          </g>
        ) : (
          <text key={`${band.key}-${band.firstCol}`} x={4} y={geo.bandBreaks.get(band.firstCol) ?? 0} className="th-text th-band">
            {truncate(name(band.key), 40)}
          </text>
        );
      })}

      {/* Noms des colonnes. */}
      {columns.map((column, c) =>
        horizontal ? (
          geo.labelChars > 0 && (
            <text key={column.key + c} x={geo.colPos[c]} y={geo.header - 16} textAnchor="middle" className="th-text th-col">
              {truncate(name(column.key), geo.labelChars)}
            </text>
          )
        ) : (
          <text key={column.key + c} x={4} y={geo.colPos[c] + 4} className="th-text th-col">
            {truncate(name(column.key), geo.labelChars)}
          </text>
        )
      )}

      {/* En vertical, le nom des lignes en tête de chaque colonne. */}
      {!horizontal &&
        rows.map((row, r) => (
          <text
            key={row.id}
            x={geo.lanePos[r]}
            y={24}
            textAnchor="middle"
            className={`th-text th-lane cursor-pointer ${selectedId && selectedId !== row.id ? 'opacity-35' : ''}`}
            style={{ pointerEvents: 'auto' }}
            onClick={() => onSelect(selectedId === row.id ? null : row.id)}
          >
            {truncate(name(row.id), Math.max(3, Math.floor(geo.laneStep / 7.2)))}
          </text>
        ))}

      {/* Rencontres : un trait qui relie les Elements présents ensemble. */}
      {encounters.map((encounter) => {
        const top = point(encounter.rows[0], encounter.col);
        const bottom = point(encounter.rows[encounter.rows.length - 1], encounter.col);
        const involved = selectedId ? encounter.rows.some((r) => rows[r].id === selectedId) : true;
        return (
          <line
            key={`enc-${encounter.col}`}
            x1={top.x}
            y1={top.y}
            x2={bottom.x}
            y2={bottom.y}
            stroke="#c7c7c7"
            strokeWidth={1.5}
            className="th-row"
            opacity={involved ? 1 : 0.12}
          />
        );
      })}

      {rows.map((row, r) => {
        const tone = pastelFor(row.id);
        const dimmed = selectedId !== null && selectedId !== row.id;
        const last = point(r, row.last);
        return (
          <g key={row.id} className="th-row" opacity={dimmed ? 0.18 : 1}>
            {row.spans.map((span) => {
              const a = point(r, span.from);
              const b = point(r, span.to);
              const pad = geo.colStep * 0.35;
              return horizontal ? (
                <rect key={`s${span.from}-${span.to}`} x={a.x - pad} y={a.y - 5} width={b.x - a.x + pad * 2} height={10} rx={5} fill={tone.bg} opacity={0.45} />
              ) : (
                <rect key={`s${span.from}-${span.to}`} x={a.x - 5} y={a.y - pad} width={10} height={b.y - a.y + pad * 2} rx={5} fill={tone.bg} opacity={0.45} />
              );
            })}

            {row.segments.map((segment) => {
              const a = point(r, segment.from);
              const b = point(r, segment.to);
              return (
                <line
                  key={`l${segment.from}-${segment.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={tone.ring}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={segment.long ? '3 6' : undefined}
                  opacity={segment.long ? 0.75 : 1}
                />
              );
            })}

            {/* Dernière apparition, quand elle n'est pas la fin du récit. */}
            {row.last < columns.length - 1 &&
              (horizontal ? (
                <line x1={last.x + 11} x2={last.x + 11} y1={last.y - 6} y2={last.y + 6} stroke="#9a9a9a" strokeWidth={1.5} strokeLinecap="round" />
              ) : (
                <line x1={last.x - 6} x2={last.x + 6} y1={last.y + 11} y2={last.y + 11} stroke="#9a9a9a" strokeWidth={1.5} strokeLinecap="round" />
              ))}

            {row.cells.map((cell) => {
              const p = point(r, cell.col);
              const present = cell.hits.length > 0;
              return (
                <g key={`c${cell.col}`}>
                  {present ? (
                    <circle cx={p.x} cy={p.y} r={5.5} fill={tone.ring} stroke="#fff" strokeWidth={2} />
                  ) : (
                    <circle cx={p.x} cy={p.y} r={5} fill="#fff" stroke={tone.ring} strokeWidth={1.5} strokeDasharray="2 2" />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={14}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onPointerEnter={() => showHover(r, cell.col)}
                    onClick={() => onOpenCell(row.id, cell, cell.col)}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {cursor && rows[cursor.row] && (
        <circle {...(() => { const p = point(cursor.row, cursor.col); return { cx: p.x, cy: p.y }; })()} r={10} fill="none" stroke="#000" strokeWidth={1.5} pointerEvents="none" />
      )}
    </svg>
  );

  return (
    <div ref={wrapRef} className="relative">
      {horizontal && bands.length > 1 && overflow && (
        <div className="mb-2 flex items-center justify-end gap-1 text-[13.5px] text-ink-3">
          <button
            onClick={() => jumpBand(-1)}
            disabled={bandIndex === 0}
            aria-label="Ensemble précédent"
            className="grid size-7 place-items-center rounded-lg transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft size={15} strokeWidth={2.2} />
          </button>
          <span className="min-w-[8rem] text-center">{truncate(name(bands[bandIndex]?.key ?? ''), 28)}</span>
          <button
            onClick={() => jumpBand(1)}
            disabled={bandIndex >= bands.length - 1}
            aria-label="Ensemble suivant"
            className="grid size-7 place-items-center rounded-lg transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            <ChevronRight size={15} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {horizontal ? (
        <div className="flex">
          {/* Les noms restent en place pendant que le temps défile. */}
          <div className="shrink-0" style={{ width: ROW_GUTTER, paddingTop: geo.header }}>
            {rows.map((row) => {
              const selected = selectedId === row.id;
              return (
                <button
                  key={row.id}
                  onClick={() => onSelect(selected ? null : row.id)}
                  aria-pressed={selected}
                  style={{ height: LANE }}
                  className={`flex w-full items-center gap-2 pr-3 text-left text-[14px] transition ${
                    selectedId && !selected ? 'opacity-35' : ''
                  }`}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: pastelFor(row.id).ring }} />
                  <span className={`truncate ${selected ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink'}`}>
                    {name(row.id)}
                  </span>
                </button>
              );
            })}
          </div>
          <div ref={scrollRef} onScroll={onScroll} className="min-w-0 flex-1 overflow-x-auto pb-2">
            {chart}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">{chart}</div>
      )}
    </div>
  );
}
