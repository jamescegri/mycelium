// Palette pastel stable : la couleur d'un Groupe est dérivée de son id, pas
// aléatoire — il garde toujours la même couleur d'une visite à l'autre.
// Chaque paire (bg, text) respecte un contraste texte/fond suffisant.
const PASTELS: { bg: string; text: string; ring: string }[] = [
  { bg: '#eaf4fb', text: '#1d4e73', ring: '#bfe0f5' }, // bleu
  { bg: '#fdf1e6', text: '#8a4b1f', ring: '#f6d9bb' }, // pêche
  { bg: '#f2ecfb', text: '#5b3b8c', ring: '#ddcdf5' }, // violet
  { bg: '#eaf8ef', text: '#276b45', ring: '#c3ecd3' }, // vert
  { bg: '#fdf6e3', text: '#8a6d1f', ring: '#f3e3ad' }, // jaune
  { bg: '#fdecef', text: '#8a2f47', ring: '#f6ccd6' }, // rose
];

export function pastelFor(id: string): { bg: string; text: string; ring: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PASTELS[hash % PASTELS.length];
}
