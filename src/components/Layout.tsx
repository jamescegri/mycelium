import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
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

// Trois colonnes : le rail dit où l'on est, la colonne du milieu sert à
// naviguer, la troisième à lire et à écrire. C'est la disposition d'un
// outil qu'on garde ouvert toute la journée — on change de sujet sans
// jamais repasser par un écran d'accueil.
//
// Sous 1024px la colonne de navigation disparaît : à cette largeur elle
// mangerait la moitié de la zone de lecture. Le rail et la palette ⌘K
// suffisent alors à atteindre n'importe quoi.
const RAIL = [
  { to: '/dashboard', label: 'Accueil', icon: Home },
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

  return (
    <div className="flex h-screen bg-surface text-ink">
      <nav
        aria-label="Navigation principale"
        className="flex w-[74px] shrink-0 flex-col items-center gap-0.5 border-r border-line-soft bg-surface-2 px-2 py-4"
      >
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Mycelium — accueil"
          className="mb-6 flex size-9 items-center justify-center"
        >
          <Logo size={26} />
        </button>

        {RAIL.map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <RailButton
              key={item.to}
              icon={item.icon}
              label={item.label}
              active={active}
              onClick={() => navigate(item.to)}
            />
          );
        })}

        <RailButton icon={Search} label="Chercher" onClick={openPalette} />

        <div className="flex-1" />

        <RailButton
          icon={Trash2}
          label="Corbeille"
          active={location.pathname.startsWith('/trash')}
          onClick={() => navigate('/trash')}
        />
        <RailButton icon={LogOut} label="Sortir" onClick={() => signOut()} />
      </nav>

      {/* Pas de troisième colonne tant qu'il n'y a rien à lire : explorer
          et lire sont deux moments, et un panneau vide à droite ferait
          croire qu'on a raté quelque chose. La colonne de navigation
          occupe alors toute la largeur. */}
      {children === null ? (
        <div className="flex min-h-0 flex-1 justify-center">
          <NavColumn wide />
        </div>
      ) : (
        <>
          <div className="hidden min-h-0 lg:flex">
            <NavColumn />
          </div>
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[56rem] px-6 py-12 sm:px-12">
              {children}
            </div>
          </main>
        </>
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
          : 'text-ink-3 hover:bg-surface-3 hover:text-ink'
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
