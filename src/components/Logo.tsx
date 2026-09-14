// Le glyphe de marque : trois nœuds reliés, pour "Mycelium" — un réseau
// d'idées connectées. Réutilisé pour la sidebar et la favicon (voir
// index.html, même dessin encodé en data URI).
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#2c6e57" />
      <circle cx="16" cy="9" r="2.4" fill="#fff" />
      <circle cx="9" cy="20" r="2.4" fill="#fff" />
      <circle cx="23" cy="20" r="2.4" fill="#fff" />
      <path
        d="M16 11.4 L10.4 18 M16 11.4 L21.6 18 M11.4 20.6 L20.6 20.6"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
