import type { CSSProperties, ReactNode } from 'react';

// Une pastille arrondie réutilisable — tags, Parents, badges de comptage.
// Remplace les liens texte nus pour donner une vraie identité visuelle aux
// petites informations, façon Notion.
export function Pill({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 ${className}`}
    >
      {children}
    </span>
  );
}
