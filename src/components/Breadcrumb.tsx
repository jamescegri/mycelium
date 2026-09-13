import { useNavigate } from 'react-router-dom';
import type { Element } from '../types';

// Fil d'Ariane complet jusqu'à la racine, cliquable à chaque niveau.
// Pense pour la future navigation "par niveaux" : c'est le même chemin
// d'ancêtres qui permettra de remonter quand une page n'affichera plus
// qu'un seul niveau à la fois.
export function Breadcrumb({
  ancestors,
  currentName,
}: {
  ancestors: Element[];
  currentName: string;
}) {
  const navigate = useNavigate();

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
      <button
        onClick={() => navigate('/elements')}
        className="hover:text-neutral-300"
      >
        Elements
      </button>
      {ancestors.map((ancestor) => (
        <span key={ancestor.id} className="flex items-center gap-1">
          <span className="text-neutral-700">/</span>
          <button
            onClick={() => navigate(`/elements/${ancestor.id}`)}
            className="max-w-[160px] truncate hover:text-neutral-300"
          >
            {ancestor.name}
          </button>
        </span>
      ))}
      <span className="text-neutral-700">/</span>
      <span className="max-w-[200px] truncate text-neutral-300">
        {currentName}
      </span>
    </nav>
  );
}
