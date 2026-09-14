import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// Une propriété par ligne. Auparavant chacune prenait son titre, sa valeur
// et son bouton d'ajout sur trois lignes : à quatre propriétés, l'éditeur
// commençait sous la ligne de flottaison, alors que c'est là qu'on vient
// écrire. Libellé étroit à gauche, valeurs à droite, tout sur une ligne qui
// se replie quand il y en a beaucoup.
export function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-3 py-1">
      <span className="flex w-[92px] shrink-0 items-center gap-1.5 text-[13.5px] text-ink-4">
        <Icon size={13} strokeWidth={2} className="shrink-0" />
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

// Le texte d'une propriété vide : présent mais en retrait, pour qu'on voie
// qu'il n'y a rien sans que ça attire l'œil.
export function PropertyEmpty({ children }: { children: string }) {
  return <span className="text-[14px] text-ink-4">{children}</span>;
}
