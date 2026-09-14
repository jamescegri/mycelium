import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
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
// Une teinte par destination, qui n'apparaît qu'au survol. La règle de
// couleur de l'app tient toujours — ce qui reste affiché à l'écran est
// achromatique, seul un lien porte une couleur durable. Ici la teinte est
// fugace : elle accompagne le geste, puis disparaît.
const RAIL = [
  { to: '/dashboard', label: 'Accueil', icon: Home, tint: '#5ce1ff' },
  { to: '/groupes', label: 'Groupes', icon: FolderTree, tint: '#5bffa5' },
  { to: '/liste', label: 'Éléments', icon: LayoutGrid, tint: '#c9a0ff' },
  { to: '/temporel', label: 'Temps', icon: Clock, tint: '#ff9d6b' },
  { to: '/tags', label: 'Tags', icon: Tag, tint: '#ff6fd8' },
  { to: '/connexions', label: 'Liens', icon: Link2, tint: '#7d9bff' },
];

export function Layout() {
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
  // Sur Groupes, l'explorateur EST la vue : il n'y a rien à lire à côté.
  const showsMain = !path.startsWith('/groupes');

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
              tint={item.tint}
              active={location.pathname.startsWith(item.to)}
              onClick={() => navigate(item.to)}
            />
          ))}
          <RailButton
            icon={Search}
            label="Chercher"
            tint="#5ce1ff"
            onClick={openPalette}
          />
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

      {showsMain && (
        <main
          className={`min-w-0 flex-1 overflow-y-auto rounded-2xl bg-surface ${
            twoPane ? 'animate-panel-in' : ''
          }`}
        >
          <Outlet />
        </main>
      )}
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  tint,
  active = false,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  tint?: string;
  active?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-current={active ? 'page' : undefined}
      // Sans libellé écrit, le nom doit rester atteignable : `aria-label`
      // pour les lecteurs d'écran, `title` pour l'infobulle du navigateur.
      aria-label={label}
      title={label}
      // Une pastille carrée plutôt qu'un bandeau sur toute la largeur du
      // rail : la surface colorée doit avoir la forme de l'icône qu'elle
      // met en avant, pas celle de la colonne qui la contient.
      className="mx-auto flex size-11 items-center justify-center rounded-xl transition"
      style={
        // La couleur reste quand la destination est celle où l'on se
        // trouve : un onglet actif qui redevient gris oblige à relire les
        // six icônes pour savoir où l'on est.
        // Corbeille et Sortir n'ont pas de teinte : ce ne sont pas des
        // destinations de travail, elles se contentent du gris de fond.
        active || hover
          ? {
              backgroundColor: tint ?? 'var(--color-surface-3)',
              color: 'var(--color-ink)',
            }
          : { color: 'var(--color-ink-3)' }
      }
    >
      <Icon size={20} strokeWidth={active ? 2.4 : 2} />
    </button>
  );
}
