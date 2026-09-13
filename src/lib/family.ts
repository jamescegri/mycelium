import type { ElementFamily } from '../types';

// Une couleur par famille, pour "sentir" dans quel espace on navigue sans
// avoir besoin d'un badge encadré partout. Les trois familles restent de
// simples points de départ organisationnels, jamais des types d'objet.
export const FAMILY_COLOR: Record<ElementFamily, string> = {
  TIME: '#67b8d8',
  SPACE: '#a78bfa',
  ELEMENTS: '#eab308',
};
