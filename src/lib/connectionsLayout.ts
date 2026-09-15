import { LINK_PRIORITY, type Reason } from './connections';

// ─────────────────────────────────────────────────────────────────────
// Géométrie du visuel de Connexions.
//
// Une seule règle d'espace : la verticale est le rangement, l'horizontale
// les connexions. Ce qui contient le centre est au-dessus, ce qu'il
// contient en dessous. À droite ce qui part de lui, à gauche ce qui arrive
// à lui — un lien nommé se lit donc toujours de gauche à droite.
//
// Le visuel montre les liens principaux, jamais tous : la liste en dessous
// les montre tous. Quand un côté déborde, passent d'abord un lien tout juste
// créé, puis ce que l'utilisateur a nommé, puis ce qui est relié de
// plusieurs façons.
// ─────────────────────────────────────────────────────────────────────

export type Place = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface PlacedNode {
  id: string;
  x: number;
  y: number;
  place: Place;
  lead?: Reason;
  // Nombre de caractères que le nom peut occuper à cette place.
  maxChars: number;
}

export interface GroupLabel {
  x: number;
  y: number;
  anchor: 'start' | 'end';
  text: string;
}

export interface GraphLayout {
  width: number;
  height: number;
  yMin: number;
  narrow: boolean;
  nodes: PlacedNode[];
  labels: GroupLabel[];
  // L'ordre du clavier : haut, droite, bas, gauche.
  order: string[];
  hiddenCount: number;
}

export const NARROW_BELOW = 560;
const MAX_SIDE = { wide: 7, narrow: 5 };
const MAX_ROW = 5;
const LINE_STEP = 70;
const CHAR_WIDTH = 7.4;

interface Candidate {
  id: string;
  lead: Reason;
  count: number;
  fresh: boolean;
}

export function layoutNeighbourhood(input: {
  centerId: string;
  reasons: Reason[];
  width: number;
  // Le Groupe d'un voisin tel que l'utilisateur l'a rangé — son premier
  // parent — et son nom. Aucun sens n'y est attaché : c'est un repère de
  // lecture.
  groupOf: (id: string) => string | null;
  groupName: (groupId: string | null) => string;
  freshIds: Set<string>;
}): GraphLayout {
  const { centerId, reasons, width: W, groupOf, groupName, freshIds } = input;
  const narrow = W < NARROW_BELOW;

  const byId = new Map<string, Reason[]>();
  for (const r of reasons) {
    const list = byId.get(r.id);
    if (list) list.push(r);
    else byId.set(r.id, [r]);
  }

  const parents: Candidate[] = [];
  const children: Candidate[] = [];
  const left: Candidate[] = [];
  const right: Candidate[] = [];

  for (const [id, list] of byId) {
    const base = { id, count: list.length, fresh: freshIds.has(id) };
    const parent = list.find((r) => r.kind === 'parent');
    if (parent) { parents.push({ ...base, lead: parent }); continue; }
    const child = list.find((r) => r.kind === 'child');
    if (child) { children.push({ ...base, lead: child }); continue; }

    const lead = LINK_PRIORITY.map((k) => list.find((r) => r.kind === k)).find(Boolean)!;
    let side: 'left' | 'right';
    if (lead.kind === 'mentions') side = 'right';
    else if (lead.kind === 'mentionedBy') side = 'left';
    else if (lead.kind === 'tag') side = left.length <= right.length ? 'left' : 'right';
    else side = lead.out ? 'right' : 'left';
    (side === 'left' ? left : right).push({ ...base, lead });
  }

  const score = (c: Candidate) =>
    (c.fresh ? -100 : 0) + LINK_PRIORITY.indexOf(c.lead.kind) * 10 - c.count;
  left.sort((a, b) => score(a) - score(b));
  right.sort((a, b) => score(a) - score(b));

  const cap = narrow ? MAX_SIDE.narrow : MAX_SIDE.wide;
  const hiddenCount =
    Math.max(0, left.length - cap) + Math.max(0, right.length - cap) +
    Math.max(0, parents.length - MAX_ROW) + Math.max(0, children.length - MAX_ROW);

  // Parmi ce qui est gardé, les voisins d'un même Groupe se suivent : le
  // Groupe le plus important d'abord, l'ordre d'origine à l'intérieur.
  const byGroup = (items: Candidate[]) => {
    const first = new Map<string | null, number>();
    items.forEach((c, i) => {
      const g = groupOf(c.id);
      if (!first.has(g)) first.set(g, i);
    });
    return [...items].sort((a, b) => first.get(groupOf(a.id))! - first.get(groupOf(b.id))!);
  };
  const L = byGroup(left.slice(0, cap));
  const R = byGroup(right.slice(0, cap));
  const P = parents.slice(0, MAX_ROW);
  const C = children.slice(0, MAX_ROW);

  // Positions en crans : un changement de Groupe ajoute un écart, pour que
  // les paquets se lisent sans trait de séparation.
  const slots = (items: Candidate[]) => {
    let t = 0;
    return items.map((c, i) => {
      if (i > 0) t += 1 + (groupOf(c.id) !== groupOf(items[i - 1].id) ? 0.7 : 0);
      return t;
    });
  };
  const sL = slots(L);
  const sR = slots(R);
  const extent = Math.max(sL.at(-1) ?? 0, sR.at(-1) ?? 0) + 1;

  const spread = (n: number) => Math.min(0.95, 0.18 + n * 0.12);
  const ry = 26 + extent * 20;
  const ringHalf = narrow
    ? Math.max(110, (extent - 1) * 31 + 70)
    : Math.max(50, ry * Math.sin(spread(extent)) + 24);

  // Sur téléphone, trois noms côte à côte au plus : au-delà, la rangée
  // passe à la ligne.
  const perLine = narrow ? 3 : MAX_ROW;
  const lines = (n: number) => Math.max(1, Math.ceil(n / perLine));
  const yMin = -(ringHalf + (P.length ? 120 + (lines(P.length) - 1) * LINE_STEP : 30));
  const yMax = ringHalf + (C.length ? 158 + (lines(C.length) - 1) * LINE_STEP : 66);

  const nodes: PlacedNode[] = [{ id: centerId, x: 0, y: 0, place: 'center', maxChars: 34 }];
  const labels: GroupLabel[] = [];
  const position = new Map<string, PlacedNode>();
  const place = (node: PlacedNode) => {
    nodes.push(node);
    position.set(node.id, node);
  };

  const row = (items: Candidate[], nearY: number, direction: 1 | -1, where: Place) => {
    for (let line = 0; line * perLine < items.length; line++) {
      const chunk = items.slice(line * perLine, (line + 1) * perLine);
      const span = Math.min(W * (narrow ? 0.66 : 0.64), chunk.length * (narrow ? 120 : 190));
      const gap = chunk.length > 1 ? span / (chunk.length - 1) : W * 0.6;
      const maxChars = Math.max(6, Math.floor((Math.min(gap, W - 24) - 14) / CHAR_WIDTH));
      chunk.forEach((c, i) => {
        place({
          id: c.id,
          x: chunk.length === 1 ? 0 : -span / 2 + gap * i,
          y: nearY + direction * line * LINE_STEP,
          place: where,
          lead: c.lead,
          maxChars: Math.min(narrow ? 16 : 24, maxChars),
        });
      });
    }
  };
  row(P, -(ringHalf + 82), -1, 'top');
  row(C, ringHalf + 114, 1, 'bottom');

  const placeSide = (items: Candidate[], s: number[], side: 'left' | 'right') => {
    const T = s.at(-1) ?? 0;
    const u = (i: number) => (T ? s[i] / T : 0.5);
    const sign = side === 'left' ? -1 : 1;

    if (narrow) {
      // La bande du milieu reste libre pour le nom du centre : les voisins
      // se répartissent régulièrement au-dessus et en dessous d'elle.
      const top = -ringHalf + 20;
      const bottom = ringHalf - 20;
      const band = 58;
      items.forEach((c, i) => {
        const t = u(i);
        const y = items.length === 1
          ? -70
          : t < 0.5 ? top + (-band - top) * (t / 0.5) : band + (bottom - band) * ((t - 0.5) / 0.5);
        place({ id: c.id, x: sign * W * 0.27, y, place: side, lead: c.lead, maxChars: 16 });
      });
      return;
    }

    const rx = W * 0.36;
    const sp = spread(extent);
    const [from, to] = side === 'right' ? [-sp, sp] : [Math.PI + sp, Math.PI - sp];
    items.forEach((c, i) => {
      const a = items.length === 1 ? (from + to) / 2 : from + (to - from) * u(i);
      const x = rx * Math.cos(a);
      // Un nom a la place qui va de son point jusqu'au bord de la page.
      const maxChars = Math.max(8, Math.min(24, Math.floor((W / 2 + 48 - Math.abs(x) - 22) / CHAR_WIDTH)));
      place({ id: c.id, x, y: ry * Math.sin(a), place: side, lead: c.lead, maxChars });
    });

    // Le nom du Groupe au-dessus de chaque paquet, seulement quand le côté
    // en mélange plusieurs — sinon il ne dirait rien.
    if (new Set(items.map((c) => groupOf(c.id))).size > 1) {
      items.forEach((c, i) => {
        const g = groupOf(c.id);
        if (i > 0 && groupOf(items[i - 1].id) === g) return;
        const p = position.get(c.id)!;
        labels.push({
          x: p.x + sign * 15,
          y: p.y - 19,
          anchor: side === 'right' ? 'start' : 'end',
          text: groupName(g),
        });
      });
    }
  };
  placeSide(L, sL, 'left');
  placeSide(R, sR, 'right');

  const order = [
    ...P.map((c) => c.id),
    ...[...R].sort((a, b) => position.get(a.id)!.y - position.get(b.id)!.y).map((c) => c.id),
    ...[...C].reverse().map((c) => c.id),
    ...[...L].sort((a, b) => position.get(b.id)!.y - position.get(a.id)!.y).map((c) => c.id),
  ];

  return { width: W, height: yMax - yMin, yMin, narrow, nodes, labels, order, hiddenCount };
}

// Le trait du centre vers un voisin, et l'endroit où poser le nom d'un
// lien nommé — là où les traits se sont déjà écartés, pour que deux noms
// ne se chevauchent pas.
export function edgeGeometry(node: PlacedNode, narrow: boolean): { d: string; labelX: number; labelY: number } {
  const vertical = node.place === 'top' || node.place === 'bottom';
  const below = node.place === 'bottom';

  if (narrow) {
    const len = Math.hypot(node.x, node.y) || 1;
    // Sous le centre se trouve son nom : un trait vers le bas commence après.
    const sx = below ? 0 : (node.x / len) * 22;
    const sy = below ? 58 : (node.y / len) * 22;
    const ex = node.x - (node.x / len) * 10;
    const ey = node.y - (node.y / len) * 10;
    return { d: `M ${sx} ${sy} L ${ex} ${ey}`, labelX: (sx + ex) / 2, labelY: (sy + ey) / 2 };
  }

  if (vertical) {
    const sy = below ? 58 : -22;
    const ey = node.y - Math.sign(node.y) * 10;
    return {
      d: `M 0 ${sy} C 0 ${ey * 0.55} ${node.x} ${ey * 0.45} ${node.x} ${ey}`,
      labelX: node.x / 2,
      labelY: ey / 2,
    };
  }

  const sx = Math.sign(node.x) * 22;
  const ex = node.x - Math.sign(node.x) * 10;
  const ey = node.y;
  const cx = ex * 0.55;
  const cy = ey * 0.1;
  const t = 0.7;
  return {
    d: `M ${sx} 0 Q ${cx} ${cy} ${ex} ${ey}`,
    labelX: (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t ** 2 * ex,
    labelY: 2 * (1 - t) * t * cy + t ** 2 * ey,
  };
}
