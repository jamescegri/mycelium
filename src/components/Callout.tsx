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
  tone?: 'neutral' | 'accent';
}) {
  const accent = tone === 'accent';

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border-l-2 py-4 pl-4 pr-5 text-sm leading-relaxed ${
        accent
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-ink-4 bg-surface-2 text-ink-2'
      }`}
    >
      <Icon size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 opacity-80" />
      <div>{children}</div>
    </div>
  );
}
