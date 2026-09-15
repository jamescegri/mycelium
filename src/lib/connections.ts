import { extractPlainText } from './content';
import { getDescendantIds } from './links';
import type { Element, ElementLink, Relation } from '../types';

// ─────────────────────────────────────────────────────────────────────
// Connexions : ce qui touche, influence ou référence un Element.
//
// Tout est dérivé des tables existantes — `element_links` pour le
// rangement, `relations` pour les liens (mentions et liens posés à la
// main, nommés ou non), les tags pour le rapprochement facultatif. Rien
// n'est stocké en plus, et aucun type d'Element n'est supposé : un Groupe
// n'est qu'un Element qui a des enfants, et son nom ne porte aucun sens
// particulier pour l'app.
// ─────────────────────────────────────────────────────────────────────

export type LinkKind =
  | 'parent'
  | 'child'
  | 'named'
  | 'mentions'
  | 'mentionedBy'
  | 'manual'
  | 'tag';

// Une raison d'être voisin. Un même Element peut en avoir plusieurs : il
// peut être à la fois mentionné et relié par un lien nommé.
export interface Reason {
  id: string;
  kind: LinkKind;
  // Pour un lien : vrai s'il part du centre.
  out?: boolean;
  label?: string;
  quote?: string | null;
  tags?: string[];
  relationId?: string;
}

// L'ordre dit ce qui compte le plus : ce que l'utilisateur a nommé lui-même
// d'abord, puis ce que le texte dit, puis le reste.
export const LINK_PRIORITY: LinkKind[] = ['named', 'mentions', 'mentionedBy', 'manual', 'tag'];

export type ShowKey = 'rangement' | 'named' | 'mentions' | 'mentionedBy' | 'manual' | 'tag';

export interface ConnectionFilters {
  show: Record<ShowKey, boolean>;
  time: 'all' | 'in' | 'out';
  // Un Groupe ou un Element qui restreint les voisins.
  scope: string | null;
}

// Les tags en commun sont éteints par défaut : partager un tag, c'est se
// ressembler, pas se toucher.
export const DEFAULT_SHOW: Record<ShowKey, boolean> = {
  rangement: true,
  named: true,
  mentions: true,
  mentionedBy: true,
  manual: true,
  tag: false,
};

// ── Index ───────────────────────────────────────────────────────────
// Préparé une fois quand les données changent, pas à chaque recentrage :
// sur quelques centaines d'Elements, relire tout le texte de l'univers à
// chaque clic se sentirait.

export interface ConnectionsIndex {
  elements: Element[];
  byId: Map<string, Element>;
  links: ElementLink[];
  relations: Relation[];
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  adjacent: Map<string, Set<string>>;
  tagsOf: Map<string, string[]>;
  chronology: Set<string>;
  // La phrase où une mention apparaît, par « source|cible ».
  quotes: Map<string, string>;
  // Le texte brut de chaque Element, et sa version sans accents.
  plain: Map<string, string>;
  normalized: Map<string, string>;
  descendantsCache: Map<string, Set<string>>;
}

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export function buildConnectionsIndex(input: {
  elements: Element[];
  links: ElementLink[];
  relations: Relation[];
  tagNames: Map<string, string>;
  elementTags: { element_id: string; tag_id: string }[];
  chronology: Set<string>;
}): ConnectionsIndex {
  const byId = new Map(input.elements.map((e) => [e.id, e]));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const adjacent = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    if (!adjacent.has(a)) adjacent.set(a, new Set());
    if (!adjacent.has(b)) adjacent.set(b, new Set());
    adjacent.get(a)!.add(b);
    adjacent.get(b)!.add(a);
  };

  // L'ordre des enfants est celui choisi par l'utilisateur.
  const sortedLinks = [...input.links].sort((a, b) => a.sort_order - b.sort_order);
  for (const l of sortedLinks) {
    if (!byId.has(l.parent_id) || !byId.has(l.child_id)) continue;
    push(parents, l.child_id, l.parent_id);
    push(children, l.parent_id, l.child_id);
    touch(l.parent_id, l.child_id);
  }

  const relations = input.relations.filter((r) => byId.has(r.source_id) && byId.has(r.target_id));
  for (const r of relations) touch(r.source_id, r.target_id);

  const tagsOf = new Map<string, string[]>();
  for (const et of input.elementTags) {
    const tagName = input.tagNames.get(et.tag_id);
    if (tagName && byId.has(et.element_id)) push(tagsOf, et.element_id, tagName);
  }

  const plain = new Map<string, string>();
  const normalized = new Map<string, string>();
  const quotes = new Map<string, string>();
  for (const el of input.elements) {
    const text = extractPlainText(el.content, Number.MAX_SAFE_INTEGER);
    plain.set(el.id, text);
    normalized.set(el.id, normalize(text));
    for (const [targetId, sentence] of mentionSentences(el.content)) {
      const key = `${el.id}|${targetId}`;
      if (!quotes.has(key)) quotes.set(key, sentence);
    }
  }

  return {
    elements: input.elements,
    byId,
    links: sortedLinks,
    relations,
    parents,
    children,
    adjacent,
    tagsOf,
    chronology: input.chronology,
    quotes,
    plain,
    normalized,
    descendantsCache: new Map(),
  };
}

export const isGroup = (index: ConnectionsIndex, id: string) =>
  (index.children.get(id)?.length ?? 0) > 0;

function descendantsOf(index: ConnectionsIndex, id: string): Set<string> {
  let set = index.descendantsCache.get(id);
  if (!set) {
    set = getDescendantIds(index.links, id);
    index.descendantsCache.set(id, set);
  }
  return set;
}

export function inScope(index: ConnectionsIndex, id: string, filters: ConnectionFilters): boolean {
  const { scope, time } = filters;
  if (scope && id !== scope) {
    // Un Groupe restreint à ce qu'il contient ; un Element sans enfants,
    // à ce qui lui est aussi relié — les voisins en commun.
    const ok = isGroup(index, scope)
      ? descendantsOf(index, scope).has(id)
      : (index.adjacent.get(scope)?.has(id) ?? false);
    if (!ok) return false;
  }
  if (time === 'in' && !index.chronology.has(id)) return false;
  if (time === 'out' && index.chronology.has(id)) return false;
  return true;
}

// Tous les voisins directs du centre, raison par raison.
export function neighbourhood(
  index: ConnectionsIndex,
  centerId: string,
  filters: ConnectionFilters
): Reason[] {
  const { show } = filters;
  const reasons: Reason[] = [];
  const keep = (id: string) => id !== centerId && inScope(index, id, filters);

  if (show.rangement) {
    for (const id of index.parents.get(centerId) ?? []) if (keep(id)) reasons.push({ id, kind: 'parent' });
    for (const id of index.children.get(centerId) ?? []) if (keep(id)) reasons.push({ id, kind: 'child' });
  }

  for (const r of index.relations) {
    const out = r.source_id === centerId;
    if (!out && r.target_id !== centerId) continue;
    const other = out ? r.target_id : r.source_id;
    if (!keep(other)) continue;

    if (r.origin === 'mention') {
      const kind = out ? 'mentions' : 'mentionedBy';
      if (show[kind]) {
        reasons.push({
          id: other, kind, out, relationId: r.id,
          quote: index.quotes.get(`${r.source_id}|${r.target_id}`) ?? null,
        });
      }
    } else if (r.label) {
      if (show.named) reasons.push({ id: other, kind: 'named', out, label: r.label, relationId: r.id });
    } else if (show.manual) {
      reasons.push({ id: other, kind: 'manual', out, relationId: r.id });
    }
  }

  const ownTags = index.tagsOf.get(centerId);
  if (show.tag && ownTags?.length) {
    for (const [id, tags] of index.tagsOf) {
      if (!keep(id)) continue;
      const shared = [...new Set(tags.filter((t) => ownTags.includes(t)))];
      if (shared.length) reasons.push({ id, kind: 'tag', tags: shared });
    }
  }

  return reasons;
}

// ── Phrases ─────────────────────────────────────────────────────────

const SENTENCE_END = /[.!?…]/;

// La phrase qui contient une position donnée d'un texte.
function sentenceAround(text: string, start: number, end: number): string {
  let from = start;
  while (from > 0 && !(SENTENCE_END.test(text[from - 1]) && /\s/.test(text[from] ?? ' '))) from -= 1;
  let to = end;
  while (to < text.length && !SENTENCE_END.test(text[to])) to += 1;
  return trimTo(text.slice(from, Math.min(text.length, to + 1)).trim(), 140);
}

function trimTo(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?…](\s|$)/);
  return trimTo((match ? match[0] : text).trim(), 120);
}

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: unknown[];
  content?: TiptapNode[];
}

// Pour chaque bloc du document (paragraphe, titre, élément de liste), on
// reconstitue le texte lu à l'écran et l'emplacement de chaque mention,
// puis on garde la phrase qui l'entoure.
function mentionSentences(content: unknown): [string, string][] {
  if (!content || typeof content !== 'object') return [];
  const found: [string, string][] = [];

  function visit(node: TiptapNode) {
    const inline = node.content?.some((c) => c.type === 'text' || c.type === 'mention');
    if (inline) {
      let text = '';
      const spans: { id: string; start: number; end: number }[] = [];
      for (const child of node.content ?? []) {
        if (child.type === 'text') text += child.text ?? '';
        else if (child.type === 'mention') {
          const label = String(child.attrs?.label ?? '');
          const id = child.attrs?.id;
          if (typeof id === 'string') spans.push({ id, start: text.length, end: text.length + label.length });
          text += label;
        } else if (child.type === 'hardBreak') text += ' ';
      }
      for (const s of spans) found.push([s.id, sentenceAround(text, s.start, s.end)]);
      return;
    }
    node.content?.forEach(visit);
  }

  visit(content as TiptapNode);
  return found;
}

// ── Cité sans lien ──────────────────────────────────────────────────
// Le nom du centre apparaît dans le texte d'un autre Element qui ne lui est
// relié d'aucune façon. Ce n'est pas une connexion mais une suggestion.
//
// Deux précautions contre les fausses alertes : l'article en tête du nom
// est ignoré (« Le pacte » se trouve dans « du pacte »), et les noms plus
// longs qui le contiennent sont masqués d'abord (« Mère d'Eakon » n'est pas
// une citation d'« Eakon »).

export interface Citation {
  id: string;
  quote: string;
}

export function coreName(name: string): string {
  return normalize(name).replace(/^(le |la |les |l['’])/, '').trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function citationMatcher(index: ConnectionsIndex, center: Element) {
  const core = coreName(center.name);
  if (core.length < 3) return null;
  const own = normalize(center.name);
  const longer = index.elements
    .map((e) => normalize(e.name))
    .filter((n) => n !== own && n.length > core.length && n.includes(core));
  return {
    // Les noms plus longs sont remplacés par autant d'espaces : les
    // positions restent alignées avec le texte d'origine.
    mask: (text: string) => longer.reduce((t, n) => t.split(n).join(' '.repeat(n.length)), text),
    pattern: new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(core)})(?=[^\\p{L}\\p{N}]|$)`, 'u'),
  };
}

export function unlinkedCitations(
  index: ConnectionsIndex,
  centerId: string,
  filters: ConnectionFilters
): Citation[] {
  const center = index.byId.get(centerId);
  if (!center) return [];
  const matcher = citationMatcher(index, center);
  if (!matcher) return [];

  const out: Citation[] = [];
  for (const el of index.elements) {
    if (el.id === centerId) continue;
    if (index.adjacent.get(centerId)?.has(el.id)) continue;
    if (!inScope(index, el.id, filters)) continue;
    const masked = matcher.mask(index.normalized.get(el.id) ?? '');
    const m = matcher.pattern.exec(masked);
    if (!m) continue;
    const start = m.index + m[1].length;
    const text = index.plain.get(el.id) ?? '';
    out.push({ id: el.id, quote: sentenceAround(text, start, start + m[2].length) });
  }
  return out;
}

// Relier une citation, c'est transformer l'occurrence du nom en vraie
// mention « / » dans le texte de l'autre Element. La relation naît ensuite
// de la synchronisation des mentions, comme pour toutes les autres : elle
// ne sera pas effacée au prochain enregistrement de ce texte.
//
// Le texte affiché ne change pas : la mention garde les mots tels qu'ils
// étaient écrits (« du pacte » reste « du pacte »), seul le lien s'ajoute.
export function insertMentionForCitation(
  content: unknown,
  center: Element,
  allElements: Element[]
): object | null {
  const core = coreName(center.name);
  if (core.length < 3) return null;
  const own = normalize(center.name);
  const longer = allElements
    .map((e) => normalize(e.name))
    .filter((n) => n !== own && n.length > core.length && n.includes(core));
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(core)})(?=[^\\p{L}\\p{N}]|$)`, 'u');

  const doc: TiptapNode =
    typeof content === 'string'
      ? {
          type: 'doc',
          content: content
            .split(/\n{2,}/)
            .map((p) => ({ type: 'paragraph', content: p ? [{ type: 'text', text: p }] : [] })),
        }
      : structuredClone((content ?? { type: 'doc', content: [] }) as TiptapNode);

  let done = false;

  function visit(node: TiptapNode) {
    if (done || !node.content) return;
    for (let i = 0; i < node.content.length && !done; i++) {
      const child = node.content[i];
      if (child.type !== 'text' || !child.text) {
        visit(child);
        continue;
      }

      // Normalisation caractère par caractère, en gardant pour chaque
      // caractère normalisé la position du caractère d'origine : c'est ce
      // qui permet de couper le texte au bon endroit malgré les accents.
      const original = child.text;
      let flat = '';
      const origin: number[] = [];
      for (let k = 0; k < original.length; k++) {
        const n = normalize(original[k]);
        for (let j = 0; j < n.length; j++) {
          flat += n[j];
          origin.push(k);
        }
      }
      const masked = longer.reduce((t, n) => t.split(n).join(' '.repeat(n.length)), flat);
      const m = pattern.exec(masked);
      if (!m) continue;

      const startFlat = m.index + m[1].length;
      const endFlat = startFlat + m[2].length - 1;
      const start = origin[startFlat];
      const end = origin[endFlat] + 1;

      const pieces: TiptapNode[] = [];
      if (start > 0) pieces.push({ ...child, text: original.slice(0, start) });
      pieces.push({
        type: 'mention',
        attrs: { id: center.id, label: original.slice(start, end), mentionSuggestionChar: '/' },
      });
      if (end < original.length) pieces.push({ ...child, text: original.slice(end) });
      node.content.splice(i, 1, ...pieces);
      done = true;
    }
  }

  visit(doc);
  return done ? doc : null;
}

// ── Garder un parcours ──────────────────────────────────────────────
// Un Element ordinaire dont le texte mentionne les étapes dans l'ordre. Ses
// mentions le font apparaître dans les connexions de chaque étape — sans
// table ni type nouveaux.
export function parcoursContent(steps: Element[]): object {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Parcours suivi dans Connexions :' }],
      },
      {
        type: 'orderedList',
        attrs: { start: 1 },
        content: steps.map((step) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'mention',
                  attrs: { id: step.id, label: step.name, mentionSuggestionChar: '/' },
                },
              ],
            },
          ],
        })),
      },
    ],
  };
}
