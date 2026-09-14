import { Columns3, LayoutGrid, List, Table } from 'lucide-react';

// Quatre façons de regarder la même liste. Aucune ne crée de donnée : ce
// sont des angles, pas des dossiers — changer de vue ne déplace rien et
// n'ajoute rien à l'Element.
export type ViewMode = 'liste' | 'galerie' | 'tableau' | 'kanban';

const MODES: { id: ViewMode; label: string; icon: typeof List }[] = [
  { id: 'liste', label: 'Liste', icon: List },
  { id: 'galerie', label: 'Galerie', icon: LayoutGrid },
  { id: 'tableau', label: 'Tableau', icon: Table },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
];

export function ViewSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Choisir une vue"
      className="flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-line p-1"
    >
      {MODES.map((mode) => {
        const active = value === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] transition ${
              active
                ? 'bg-accent font-semibold text-white'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <mode.icon size={14} strokeWidth={2} />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
