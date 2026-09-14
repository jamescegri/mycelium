import type { ElementFamily } from '../types';

// Une couleur par famille, pour "sentir" de quoi on parle sans avoir
// besoin d'un badge encadré partout. Family reste une simple étiquette
// (Temps sert de base à la future timeline), jamais un type d'objet.
// Tons sourds, accordés à la palette des Groupes.
export const FAMILY_COLOR: Record<ElementFamily, string> = {
  TIME: '#3c5070',
  ELEMENTS: '#2c6e57',
};
