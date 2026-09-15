import { timelineRows } from './chronology';
import { DEFAULT_SHOW, unlinkedCitations, type ConnectionsIndex } from './connections';
import type { TemporalRelation } from '../types';

// ─────────────────────────────────────────────────────────────────────
// Fils : suivre des Elements le long de la chronologie.
//
// Une lecture calculée, jamais stockée. Les colonnes sont les « moments »
// de la Timeline existante (ses feuilles, dans l'ordre de lecture) ; une
// ligne par Element suivi ; la présence vient des mentions « / » déjà
// synchronisées dans `relations`.
//
// Rien ne sait ce que contient un Groupe : suivre « Personnages », « Lieux »
// ou « Armes » passe par le même chemin. Et les niveaux Scènes · Chapitres ·
// Tomes ne sont pas des types — ce sont des distances dans la hiérarchie :
// un moment, son parent, le parent de son parent.
// ─────────────────────────────────────────────────────────────────────

export type ThreadLevel = 'scenes' | 'chapitres' | 'tomes';
export const THREAD_LEVELS: ThreadLevel[] = ['scenes', 'chapitres', 'tomes'];
const LEVEL_DEPTH: Record<ThreadLevel, number> = { scenes: 0, chapitres: 1, tomes: 2 };

// Au-delà, un niveau plus large est choisi par défaut.
const MAX_DEFAULT_COLUMNS = 48;
// Une absence d'au moins ce nombre de colonnes se dessine en pointillé.
export const LONG_ABSENCE = 3;

export type FollowSource =
  | { kind: 'group'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'custom'; ids: string[] };

// Ce qu'on suit vit dans l'adresse, sous une forme courte.
export function encodeSource(source: FollowSource): string {
  if (source.kind === 'group') return `g:${source.id}`;
  if (source.kind === 'tag') return `t:${source.id}`;
  return `e:${source.ids.join(',')}`;
}

export function decodeSource(value: string | null | undefined): FollowSource | null {
  if (!value || value.length < 3) return null;
  const prefix = value.slice(0, 2);
  const rest = value.slice(2);
  if (prefix === 'g:') return { kind: 'group', id: rest };
  if (prefix === 't:') return { kind: 'tag', id: rest };
  if (prefix === 'e:') {
    const ids = rest.split(',').filter(Boolean);
    return ids.length ? { kind: 'custom', ids } : null;
  }
  return null;
}

export function resolveFollowed(
  source: FollowSource,
  index: ConnectionsIndex,
  elementTags: { element_id: string; tag_id: string }[]
): string[] {
  let ids: string[];
  if (source.kind === 'group') ids = index.children.get(source.id) ?? [];
  else if (source.kind === 'tag') ids = elementTags.filter((et) => et.tag_id === source.id).map((et) => et.element_id);
  else ids = source.ids;
  return [...new Set(ids)].filter((id) => index.byId.has(id));
}

// ── Modèle ──────────────────────────────────────────────────────────

export interface Moment {
  id: string;
  // Les ancêtres dans la chronologie, de la racine au parent direct.
  path: string[];
}

// Une présence : une mention dans le texte d'un moment (`direct`), ou dans
// le texte d'un ensemble — un chapitre — qui couvre alors tous ses moments.
export interface Hit {
  first: number;
  last: number;
  sourceId: string;
  quote: string | null;
  count: number;
  direct: boolean;
}

// Le nom écrit dans un moment, sans « / ». Une suggestion, pas une présence.
export interface CitationHit {
  elementId: string;
  sourceId: string;
  index: number;
  quote: string;
}

export interface ThreadsModel {
  moments: Moment[];
  momentIndex: Map<string, number>;
  containerRange: Map<string, { first: number; last: number }>;
  followed: string[];
  hits: Map<string, Hit[]>;
  never: string[];
  citations: CitationHit[];
}

interface TiptapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
}

function countMentions(content: unknown, targetId: string): number {
  if (!content || typeof content !== 'object') return 0;
  let n = 0;
  const visit = (node: TiptapNode) => {
    if (node.type === 'mention' && node.attrs?.id === targetId) n += 1;
    node.content?.forEach(visit);
  };
  visit(content as TiptapNode);
  return n;
}

export function buildThreadsModel(
  index: ConnectionsIndex,
  temporal: TemporalRelation[],
  followed: string[],
  options: { citations?: boolean } = {}
): ThreadsModel {
  const followedSet = new Set(followed);

  // La chronologie existante, dans l'ordre de lecture, avec pour chaque
  // ligne le chemin de ses ancêtres.
  const rows = timelineRows(index.elements, index.links, temporal);
  const withPath: { id: string; path: string[] }[] = [];
  const stack: string[] = [];
  for (const row of rows) {
    stack.length = row.depth;
    withPath.push({ id: row.element.id, path: [...stack] });
    stack.push(row.element.id);
  }

  // Un moment est une feuille de la chronologie. Deux précautions :
  // - un Element suivi n'est jamais un moment, même si l'héritage l'a fait
  //   entrer dans la chronologie (un personnage rangé sous une scène avec
  //   « + ») ;
  // - une scène dont les seuls enfants sont des Elements suivis reste donc
  //   une feuille.
  const hasEligibleChild = new Set<string>();
  for (const r of withPath) {
    if (!followedSet.has(r.id) && r.path.length) hasEligibleChild.add(r.path[r.path.length - 1]);
  }
  const moments: Moment[] = [];
  const momentIndex = new Map<string, number>();
  for (const r of withPath) {
    // Un Element rangé à deux endroits du récit garde sa première place.
    if (followedSet.has(r.id) || hasEligibleChild.has(r.id) || momentIndex.has(r.id)) continue;
    momentIndex.set(r.id, moments.length);
    moments.push({ id: r.id, path: r.path });
  }

  const containerRange = new Map<string, { first: number; last: number }>();
  moments.forEach((m, i) => {
    for (const ancestor of m.path) {
      const range = containerRange.get(ancestor);
      if (!range) containerRange.set(ancestor, { first: i, last: i });
      else range.last = i;
    }
  });

  // Les présences : les mentions déjà synchronisées, dont la source est un
  // moment ou un ensemble de moments.
  const hits = new Map<string, Hit[]>();
  const seen = new Set<string>();
  for (const r of index.relations) {
    if (r.origin !== 'mention' || !followedSet.has(r.target_id) || r.source_id === r.target_id) continue;
    const key = `${r.source_id}|${r.target_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const at = momentIndex.get(r.source_id);
    const range = at === undefined ? containerRange.get(r.source_id) : undefined;
    if (at === undefined && !range) continue;
    const source = index.byId.get(r.source_id);
    const hit: Hit = {
      first: at ?? range!.first,
      last: at ?? range!.last,
      sourceId: r.source_id,
      quote: index.quotes.get(key) ?? null,
      count: Math.max(1, source ? countMentions(source.content, r.target_id) : 1),
      direct: at !== undefined,
    };
    const list = hits.get(r.target_id);
    if (list) list.push(hit);
    else hits.set(r.target_id, [hit]);
  }
  for (const list of hits.values()) list.sort((a, b) => a.first - b.first || a.last - b.last);

  const never = followed.filter((id) => !hits.has(id));

  // Les noms écrits sans « / » dans un moment : ce que le graphique ne voit
  // pas encore. Même détection que Connexions.
  const citations: CitationHit[] = [];
  if (options.citations !== false) {
    const filters = { show: DEFAULT_SHOW, time: 'all' as const, scope: null };
    for (const id of followed) {
      for (const c of unlinkedCitations(index, id, filters)) {
        const at = momentIndex.get(c.id);
        if (at !== undefined) citations.push({ elementId: id, sourceId: c.id, index: at, quote: c.quote });
      }
    }
    citations.sort((a, b) => a.index - b.index);
  }

  return { moments, momentIndex, containerRange, followed, hits, never, citations };
}

// Quand rien n'est demandé, on suit le Groupe dont les enfants sont le plus
// souvent mentionnés dans la chronologie : c'est le plus parlant à ouvrir.
export function bestGroup(index: ConnectionsIndex): string | null {
  const score = new Map<string, number>();
  const counted = new Set<string>();
  for (const r of index.relations) {
    if (r.origin !== 'mention') continue;
    if (!index.chronology.has(r.source_id) || index.chronology.has(r.target_id)) continue;
    if (counted.has(`${r.source_id}|${r.target_id}`)) continue;
    counted.add(`${r.source_id}|${r.target_id}`);
    for (const parent of index.parents.get(r.target_id) ?? []) {
      if (index.chronology.has(parent)) continue;
      score.set(parent, (score.get(parent) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [id, s] of score) {
    if (s > bestScore) { best = id; bestScore = s; }
  }
  return best;
}

// Les plus présents d'abord : 8 à 12 lignes restent lisibles sans défiler.
export function defaultSelection(model: ThreadsModel, count = 10): string[] {
  const weight = (id: string) => model.hits.get(id)?.length ?? 0;
  const first = (id: string) => model.hits.get(id)?.[0]?.first ?? Infinity;
  return model.followed
    .filter((id) => model.hits.has(id))
    .sort((a, b) => weight(b) - weight(a) || first(a) - first(b))
    .slice(0, count);
}

// Les lignes dans l'ordre de leur première apparition : on lit l'entrée en
// scène des Elements de haut en bas.
export function orderRows(model: ThreadsModel, ids: string[]): string[] {
  const first = (id: string) => model.hits.get(id)?.[0]?.first ?? Infinity;
  return ids.filter((id) => model.hits.has(id)).sort((a, b) => first(a) - first(b));
}

// ── Colonnes et en-têtes ────────────────────────────────────────────

export interface Column {
  // Le moment, ou l'ensemble qui regroupe les moments à ce niveau.
  key: string;
  first: number;
  last: number;
}

export interface Band {
  key: string;
  firstCol: number;
  lastCol: number;
}

const ancestorAt = (moment: Moment, distance: number): string | null =>
  moment.path.length >= distance ? moment.path[moment.path.length - distance] : null;

export function columnsFor(model: ThreadsModel, level: ThreadLevel): Column[] {
  const depth = LEVEL_DEPTH[level];
  const columns: Column[] = [];
  model.moments.forEach((m, i) => {
    // Une branche moins profonde que le niveau demandé se regroupe sous sa
    // racine, ou reste elle-même.
    const key = depth === 0 ? m.id : (ancestorAt(m, depth) ?? m.path[0] ?? m.id);
    const prev = columns[columns.length - 1];
    if (prev && prev.key === key && prev.last === i - 1) prev.last = i;
    else columns.push({ key, first: i, last: i });
  });
  return columns;
}

// L'ensemble qui chapeaute les colonnes : les chapitres au-dessus des
// scènes, les tomes au-dessus des chapitres.
export function bandsFor(model: ThreadsModel, columns: Column[], level: ThreadLevel): Band[] {
  const distance = LEVEL_DEPTH[level] + 1;
  const bands: Band[] = [];
  columns.forEach((c, ci) => {
    const key = ancestorAt(model.moments[c.first], distance);
    if (!key) return;
    const prev = bands[bands.length - 1];
    if (prev && prev.key === key && prev.lastCol === ci - 1) prev.lastCol = ci;
    else bands.push({ key, firstCol: ci, lastCol: ci });
  });
  return bands;
}

export function autoLevel(model: ThreadsModel): ThreadLevel {
  for (const level of THREAD_LEVELS) {
    if (columnsFor(model, level).length <= MAX_DEFAULT_COLUMNS) return level;
  }
  return 'tomes';
}

// ── Données du graphique ────────────────────────────────────────────

export interface Cell {
  col: number;
  hits: Hit[];
  citations: CitationHit[];
}

export interface ChartRow {
  id: string;
  cells: Cell[];
  // Mentions dans le texte d'un ensemble qui couvre plusieurs colonnes.
  spans: { from: number; to: number }[];
  segments: { from: number; to: number; long: boolean }[];
  first: number;
  last: number;
}

export interface Encounter {
  col: number;
  rows: number[];
}

export function buildChart(
  model: ThreadsModel,
  columns: Column[],
  rowIds: string[]
): { rows: ChartRow[]; encounters: Encounter[] } {
  const colOf = new Array<number>(model.moments.length);
  columns.forEach((c, ci) => {
    for (let i = c.first; i <= c.last; i++) colOf[i] = ci;
  });

  const rows: ChartRow[] = rowIds.map((id) => {
    const byCol = new Map<number, Cell>();
    const cell = (col: number) => {
      let found = byCol.get(col);
      if (!found) {
        found = { col, hits: [], citations: [] };
        byCol.set(col, found);
      }
      return found;
    };
    const spans: { from: number; to: number }[] = [];

    for (const hit of model.hits.get(id) ?? []) {
      const from = colOf[hit.first];
      const to = colOf[hit.last];
      if (from === to) cell(from).hits.push(hit);
      else spans.push({ from, to });
    }
    for (const c of model.citations) if (c.elementId === id) cell(colOf[c.index]).citations.push(c);

    const cells = [...byCol.values()].sort((a, b) => a.col - b.col);
    // La ligne ne court qu'entre la première et la dernière apparition.
    const points = [...new Set([
      ...cells.filter((c) => c.hits.length).map((c) => c.col),
      ...spans.flatMap((s) => [s.from, s.to]),
    ])].sort((a, b) => a - b);
    const covered = (a: number, b: number) => spans.some((s) => s.from <= a && b <= s.to);
    const segments = points.slice(1).map((to, i) => {
      const from = points[i];
      return { from, to, long: to - from - 1 >= LONG_ABSENCE && !covered(from, to) };
    });

    return { id, cells, spans, segments, first: points[0] ?? 0, last: points[points.length - 1] ?? 0 };
  });

  // Une rencontre : au moins deux Elements présents dans le même moment.
  // Les mentions dans le texte d'un ensemble n'en font pas : elles disent
  // « quelque part dans ce chapitre », pas « ensemble ».
  const encounters: Encounter[] = [];
  columns.forEach((_, col) => {
    const present = rows.flatMap((row, ri) => (row.cells.some((c) => c.col === col && c.hits.length) ? [ri] : []));
    if (present.length >= 2) encounters.push({ col, rows: present });
  });

  return { rows, encounters };
}
