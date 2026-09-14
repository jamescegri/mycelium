import type { ElementFamily } from '../types';

// La famille n'est pas une variable : c'est une étiquette de l'Element
// lui-même. Elle reste donc en noir et blanc comme le reste du châssis —
// la couleur est réservée aux liens ("/", "@", "+") et aux Groupes.
export const FAMILY_COLOR: Record<ElementFamily, string> = {
  TIME: '#737373',
  ELEMENTS: '#737373',
};

export const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Temps',
  ELEMENTS: 'Element',
};
