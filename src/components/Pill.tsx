import type { CSSProperties, ReactNode } from 'react';
import { pastelFor } from '../lib/palette';

// Une pastille arrondie réutilisable — tags, Parents, badges de comptage.
// Remplace les liens texte nus pour donner une vraie identité visuelle aux
// petites informations, façon Notion.
//
// `tone` prend l'id de ce que la pastille désigne (un tag, un Element) et
// en tire une teinte stable : le même tag garde sa couleur d'un écran à
// l'autre, ce qui le rend reconnaissable avant d'être lu. Sans `tone`, la
// pastille reste achromatique — c'est le défaut, la couleur se demande.
export function Pill({
  children,
  tone,
  className = '',
  style,
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const colors = tone ? pastelFor(tone) : null;

  return (
    <span
      style={
        colors
          ? { backgroundColor: colors.bg, color: colors.text, ...style }
          : style
      }
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] ${
        colors ? 'border border-transparent' : 'border border-line bg-white text-ink-2'
      } ${className}`}
    >
      {children}
    </span>
  );
}
