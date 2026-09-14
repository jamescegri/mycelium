// Le glyphe de marque : trois nœuds reliés, pour "Mycelium" — un réseau
// d'idées connectées. Réutilisé pour la sidebar et la favicon (voir
// index.html, même dessin encodé en data URI).
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#eab308" />
      <circle cx="16" cy="9" r="2.6" fill="#fff" />
      <circle cx="9" cy="19" r="2.6" fill="#fff" />
      <circle cx="23" cy="19" r="2.6" fill="#fff" />
      <path
        d="M16 11.4 L10.6 17 M16 11.4 L21.4 17 M11.8 19.8 L20.2 19.8"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
