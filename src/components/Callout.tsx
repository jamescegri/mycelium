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
      className={`flex items-start gap-3.5 rounded-2xl border-l-[3px] py-5 pl-5 pr-6 text-[16px] leading-relaxed ${
        accent
          ? 'border-ink bg-surface-2 text-ink'
          : 'border-ink-4 bg-surface-2 text-ink-2'
      }`}
    >
      <Icon size={19} strokeWidth={2} className="mt-0.5 shrink-0 opacity-80" />
      <div>{children}</div>
    </div>
  );
}
