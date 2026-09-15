import type { ThreadLevel } from './threads';

// ─────────────────────────────────────────────────────────────────────
// Géométrie du graphique Fils.
//
// Sur ordinateur, le temps court de gauche à droite et chaque Element garde
// sa rangée. Sur téléphone, le temps descend : on fait défiler l'histoire
// comme une page, pas un tableau de côté.
// ─────────────────────────────────────────────────────────────────────

export const VERTICAL_BELOW = 640;
export const ROW_GUTTER = 172;
export const LANE = 44;

const PAD = 12;
const MIN_STEP: Record<ThreadLevel, number> = { scenes: 64, chapitres: 84, tomes: 112 };
const MAX_STEP = 150;
const VERTICAL_STEP: Record<ThreadLevel, number> = { scenes: 38, chapitres: 46, tomes: 54 };
const CHAR = 6.8;

export interface ThreadsGeometry {
  orientation: 'horizontal' | 'vertical';
  width: number;
  height: number;
  header: number;
  colStep: number;
  laneStep: number;
  // Nombre de caractères disponibles pour le nom d'une colonne ; 0 le masque.
  labelChars: number;
  // En vertical : la largeur de la colonne des noms de moments.
  timeGutter: number;
  // Centre de chaque colonne le long du temps, de chaque rangée en travers.
  colPos: number[];
  lanePos: number[];
  // En vertical : la position des intertitres, par colonne où commence un
  // ensemble.
  bandBreaks: Map<number, number>;
}

export function layoutThreads(input: {
  width: number;
  columns: number;
  rows: number;
  level: ThreadLevel;
  bandStarts: number[];
}): ThreadsGeometry {
  const { width, columns, rows, level, bandStarts } = input;

  if (width < VERTICAL_BELOW) {
    const timeGutter = Math.round(Math.min(132, width * 0.36));
    const laneStep = rows ? Math.max(40, Math.min(72, (width - timeGutter - PAD) / rows)) : 56;
    const header = 40;
    const colStep = VERTICAL_STEP[level];
    const starts = new Set(bandStarts);
    const bandBreaks = new Map<number, number>();
    const colPos: number[] = [];
    let y = header;
    for (let i = 0; i < columns; i++) {
      if (starts.has(i)) {
        y += 34;
        bandBreaks.set(i, y - 12);
      }
      colPos.push(y + colStep / 2);
      y += colStep;
    }
    return {
      orientation: 'vertical',
      width: Math.ceil(timeGutter + rows * laneStep + PAD),
      height: Math.ceil(y + 12),
      header,
      colStep,
      laneStep,
      labelChars: Math.max(0, Math.floor((timeGutter - 14) / 6.6)),
      timeGutter,
      colPos,
      lanePos: Array.from({ length: rows }, (_, r) => timeGutter + r * laneStep + laneStep / 2),
      bandBreaks,
    };
  }

  const available = Math.max(0, width - ROW_GUTTER - PAD * 2);
  const colStep = columns
    ? Math.max(MIN_STEP[level], Math.min(MAX_STEP, available / columns))
    : MIN_STEP[level];
  const rawChars = Math.floor((colStep - 10) / CHAR);
  const labelChars = rawChars >= 6 ? rawChars : 0;
  const header = 30 + (labelChars ? 24 : 0) + 10;

  return {
    orientation: 'horizontal',
    width: Math.ceil(PAD * 2 + columns * colStep),
    height: Math.ceil(header + rows * LANE + 12),
    header,
    colStep,
    laneStep: LANE,
    labelChars,
    timeGutter: 0,
    colPos: Array.from({ length: columns }, (_, c) => PAD + c * colStep + colStep / 2),
    lanePos: Array.from({ length: rows }, (_, r) => header + r * LANE + LANE / 2),
    bandBreaks: new Map(),
  };
}
