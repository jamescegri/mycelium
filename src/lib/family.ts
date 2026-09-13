import type { ElementFamily } from '../types';

// Une couleur par famille, pour "sentir" de quoi on parle sans avoir
// besoin d'un badge encadré partout. Family reste une simple étiquette
// (Temps sert de base à la future timeline), jamais un type d'objet.
export const FAMILY_COLOR: Record<ElementFamily, string> = {
  TIME: '#0284c7',
  ELEMENTS: '#eab308',
};
