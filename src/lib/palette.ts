// Palette pastel stable : la couleur d'un Groupe est dérivée de son id, pas
// aléatoire — il garde toujours la même couleur d'une visite à l'autre.
// Tons terreux et désaturés, accordés entre eux (aucun jaune, aucune
// couleur vive). Chaque paire (bg, text) dépasse 4.5:1 de contraste.
const PASTELS: { bg: string; text: string; ring: string }[] = [
  { bg: '#e6f0e9', text: '#275b43', ring: '#cfe2d6' }, // mousse
  { bg: '#f7ebe2', text: '#7a4a2e', ring: '#ecd6c5' }, // argile
  { bg: '#e7edf7', text: '#33507c', ring: '#d1dcef' }, // ardoise
  { bg: '#efe9f7', text: '#553d7d', ring: '#ddd2ef' }, // lilas
  { bg: '#e6f0f1', text: '#255c60', ring: '#cee2e4' }, // sarcelle
  { bg: '#f9e9ec', text: '#7d3949', ring: '#efd2d9' }, // rose sourd
];

// FNV-1a : bien plus dispersant qu'un simple hash *31 sur des uuid dont
// les premiers caractères se ressemblent — deux Groupes voisins ne
// tombent pas sur la même teinte.
export function pastelFor(id: string): { bg: string; text: string; ring: string } {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return PASTELS[hash % PASTELS.length];
}
