// Le mark : un fil qui se divise puis se REJOINT. C'est le plus petit graphe
// orienté possible, et c'est littéralement le modèle de l'app — un Element
// peut avoir plusieurs parents, donc les chemins convergent.
//
// Volontairement pas un champignon : le mycélium est le réseau souterrain,
// le champignon n'en est que la partie visible. C'est le réseau que cette
// app manipule.
//
// Les deux arcs ne sont pas symétriques et les nœuds latéraux sont
// légèrement décalés en hauteur : une symétrie parfaite donnerait un
// pictogramme géométrique, pas quelque chose qui a poussé.
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#000000" />
      <g
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.65"
      >
        <path d="M14.3 8 C 11.2 9.7 8.2 11.7 7.2 13.5" />
        <path d="M17.7 8.1 C 20.7 10 23.7 12.1 24.7 14.4" />
        <path d="M7 17.8 C 8.2 20.6 11.4 22.8 14.2 24" />
        <path d="M25 18.5 C 23.8 21.2 20.7 23.3 17.8 24.1" />
      </g>
      {/* Les trois fluo des déclencheurs "/", "@" et "+" : la marque énonce
          la règle de couleur de l'app. */}
      <circle cx="16" cy="5.8" r="2.6" fill="#c9a0ff" />
      <circle cx="6.2" cy="15.6" r="2.1" fill="#5ce1ff" />
      <circle cx="25.8" cy="16.4" r="2.1" fill="#5bffa5" />
      <circle cx="16" cy="26.2" r="2.6" fill="#ffffff" />
    </svg>
  );
}
