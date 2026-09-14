import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';

// Bloc "callout" façon Notion : fond teinté, filet de couleur à gauche,
// icône — pour les états vides et les indications, plutôt que du texte
// gris plat perdu dans la page.
export function Callout({
  icon: Icon = Info,
  children,
  tone = 'neutral',
}: {
  icon?: LucideIcon;
  children: ReactNode;
  tone?: 'neutral' | 'yellow';
}) {
  const bg = tone === 'yellow' ? '#fdf6e3' : '#f7f7f5';
  const border = tone === 'yellow' ? '#eab308' : '#d4d4d4';
  const text = tone === 'yellow' ? '#8a6d1f' : '#6b6b6b';

  return (
    <div
      className="flex items-start gap-3 rounded-lg border-l-[3px] px-4 py-3 text-sm"
      style={{ backgroundColor: bg, borderColor: border, color: text }}
    >
      <Icon size={17} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
