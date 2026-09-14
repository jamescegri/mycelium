import { extractPlainText } from './content';
import { displayName } from './display';
import type { Element } from '../types';

// Chercher dans un univers, c'est rarement chercher un titre. On se
// souvient d'une phrase, d'un nom prononcé au détour d'une scène — pas de
// la façon dont on a nommé la page qui la contient. La recherche regarde
// donc le texte autant que le nom, et montre le passage trouvé pour qu'on
// reconnaisse le bon résultat sans avoir à l'ouvrir.

export interface SearchHit {
  element: Element;
  // Vrai quand c'est le nom qui correspond : ces résultats passent devant,
  // parce qu'on cherche plus souvent une page qu'une phrase.
  inName: boolean;
  // Le passage où le mot apparaît, avec ce qui l'entoure. Null quand la
  // correspondance est dans le nom seul.
  excerpt: string | null;
}

// Sans accents et en minuscules : en français, "mystere" doit trouver
// "Mystère", sans quoi la recherche punit la frappe rapide.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Le passage autour de la première occurrence, coupé aux espaces pour ne
// pas trancher un mot en deux. Les bords sont marqués d'une ellipse quand
// on entre ou sort en plein texte.
function excerptAround(text: string, at: number, length: number): string {
  const before = 32;
  const width = 120;
  let start = Math.max(0, at - before);
  let end = Math.min(text.length, start + width);

  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space !== -1 && space > at + length) end = space;
  }

  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end).trim() +
    (end < text.length ? '…' : '')
  );
}

export function searchFullText(
  elements: Element[],
  query: string
): SearchHit[] {
  const q = normalize(query.trim());
  if (!q) return [];

  const hits: SearchHit[] = [];

  for (const element of elements) {
    const name = displayName(element);
    if (normalize(name).includes(q)) {
      hits.push({ element, inName: true, excerpt: null });
      continue;
    }

    // Le texte complet, pas l'aperçu tronqué : une occurrence au chapitre
    // trois doit se trouver aussi bien qu'une occurrence en première ligne.
    const body = extractPlainText(element.content, Number.MAX_SAFE_INTEGER);
    if (!body) continue;

    const at = normalize(body).indexOf(q);
    if (at === -1) continue;

    hits.push({
      element,
      inName: false,
      excerpt: excerptAround(body, at, q.length),
    });
  }

  // Les titres d'abord, le texte ensuite : chercher "Eakon" doit donner la
  // page d'Eakon avant les vingt scènes où son nom est prononcé.
  return hits.sort((a, b) => Number(b.inName) - Number(a.inName));
}
