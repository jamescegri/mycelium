import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
  FolderTree,
  Home,
  LayoutGrid,
  Link2,
  LogOut,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useCommandPalette } from './CommandPalette';
import { NavColumn } from './NavColumn';
import { Logo } from './Logo';

// Des panneaux posés sur un fond, plutôt que des zones séparées par des
// filets : la marge autour de chacun fait le travail qu'un trait ferait
// moins bien, et l'interface respire au lieu de buter contre l'écran.
//
// Explorer et lire sont deux moments. Tant qu'aucun Element n'est ouvert,
// l'explorateur occupe toute la place ; le panneau de lecture n'apparaît
// qu'une fois qu'on a choisi quelque chose, en glissant depuis la droite —
// on voit d'où il vient, donc on comprend qu'on peut y revenir.
const RAIL = [
  { to: '/dashboard', label: 'Accueil', icon: Home },
  { to: '/groupes', label: 'Groupes', icon: FolderTree },
  { to: '/liste', label: 'Éléments', icon: LayoutGrid },
  { to: '/temporel', label: 'Temps', icon: Clock },
  { to: '/tags', label: 'Tags', icon: Tag },
  { to: '/connexions', label: 'Liens', icon: Link2 },
];

export function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { open: openPalette } = useCommandPalette();

  const path = location.pathname;

  // Les vues qui se servent de la colonne de navigation. Deux fenêtres
  // quand elle sert à choisir ce qu'on lit à côté ; seule et au large
  // quand on ne fait qu'explorer.
  const usesNav =
    path.startsWith('/groupes') ||
    path.startsWith('/tags') ||
    path.startsWith('/elements/');
  const twoPane = path.startsWith('/tags') || path.startsWith('/elements/');

  return (
    <div className="flex h-screen gap-2.5 bg-surface-2 p-2.5 text-ink">
      <nav
        aria-label="Navigation principale"
        className="flex w-[76px] shrink-0 flex-col items-center rounded-2xl bg-surface px-2 py-4"
      >
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Mycelium — accueil"
          className="flex size-11 items-center justify-center text-ink"
        >
          <Logo size={34} />
        </button>

        {/* Les destinations sont groupées au centre : au repos l'œil s'y
            pose sans avoir à remonter en haut de l'écran. */}
        <div className="flex w-full flex-1 flex-col justify-center gap-0.5">
          {RAIL.map((item) => (
            <RailButton
              key={item.to}
              icon={item.icon}
              label={item.label}
              active={location.pathname.startsWith(item.to)}
              onClick={() => navigate(item.to)}
            />
          ))}
          <RailButton icon={Search} label="Chercher" onClick={openPalette} />
        </div>

        <div className="flex w-full flex-col gap-0.5">
          <RailButton
            icon={Trash2}
            label="Corbeille"
            active={location.pathname.startsWith('/trash')}
            onClick={() => navigate('/trash')}
          />
          <RailButton icon={LogOut} label="Sortir" onClick={() => signOut()} />
        </div>
      </nav>

      {/* La colonne reste montée même quand la vue ne s'en sert pas : la
          démonter perdrait l'endroit où l'on était dans l'arborescence, et
          ouvrir une scène du chapitre 12 ramènerait à la racine. On la
          masque, on ne la jette pas. */}
      <div
        className={
          !usesNav
            ? 'hidden'
            : twoPane
              ? 'flex min-h-0 w-[300px] shrink-0 overflow-hidden rounded-2xl bg-surface max-lg:hidden'
              : 'flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-surface'
        }
      >
        <NavColumn wide={!twoPane} />
      </div>

      {children !== null && (
        <main
          className={`min-w-0 flex-1 overflow-y-auto rounded-2xl bg-surface ${
            twoPane ? 'animate-panel-in' : ''
          }`}
        >
          {children}
        </main>
      )}
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition ${
        active
          ? 'bg-surface-3 text-ink'
          : 'text-ink-3 hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <Icon size={19} strokeWidth={2} />
      {/* Le libellé reste écrit : une icône seule oblige à deviner, et
          "Temps" ou "Liens" ne se devinent pas. */}
      <span
        className={`text-[9.5px] tracking-[0.04em] uppercase ${
          active ? 'font-semibold' : 'font-medium'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
