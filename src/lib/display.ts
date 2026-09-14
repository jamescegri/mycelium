import { extractPlainText } from './content';
import type { Element } from '../types';

// Depuis que la barre de capture écrit dans le contenu et non dans le titre,
// un Element passe ses premiers instants sans nom. Une liste pleine de
// "Sans titre" serait inutilisable : on retombe donc sur ses premiers mots,
// qui sont précisément ce qu'on vient d'écrire.
export function displayName(element: Element): string {
  const name = element.name?.trim();
  if (name) return name;
  const preview = extractPlainText(element.content, 60);
  if (preview) return preview;
  return 'Sans titre';
}

// Vrai quand l'Element n'a pas encore de vrai titre — l'affichage peut alors
// le montrer en retrait, pour qu'on voie d'un coup d'œil ce qui reste à
// nommer.
export function isUntitled(element: Element): boolean {
  return !element.name?.trim();
}
