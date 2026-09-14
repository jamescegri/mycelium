// Les Groupes sont, avec les variables "/" "@" "+", le seul endroit de
// l'app où la couleur est autorisée. Sur une grille de cartes, la teinte
// fait le travail qu'un titre seul ne fait pas : on retrouve "Personnages"
// à sa couleur avant même d'avoir lu son nom.
//
// Fluo saturés, texte noir par-dessus : chaque fond dépasse 7:1 avec
// l'encre, donc le fluo reste parfaitement lisible. Aucun jaune.
const FLUO: { bg: string; ring: string }[] = [
  { bg: '#5ce1ff', ring: '#16c3e8' }, // cyan
  { bg: '#ff6fd8', ring: '#f52bb5' }, // magenta
  { bg: '#5bffa5', ring: '#0fd975' }, // vert
  { bg: '#c9a0ff', ring: '#9b56f5' }, // violet
  { bg: '#ff9d6b', ring: '#f2661f' }, // orange
  { bg: '#7d9bff', ring: '#3f66f0' }, // bleu
];

// Le texte sur une carte de Groupe est toujours noir : c'est ce qui rend
// le fluo utilisable en aplat plein sans tomber sous le seuil de
// contraste.
export const GROUP_TEXT = '#000000';

// FNV-1a : bien plus dispersant qu'un simple hash *31 sur des uuid dont
// les premiers caractères se ressemblent — deux Groupes voisins ne
// tombent pas sur la même teinte.
export function pastelFor(id: string): { bg: string; text: string; ring: string } {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const tone = FLUO[hash % FLUO.length];
  return { bg: tone.bg, ring: tone.ring, text: GROUP_TEXT };
}
