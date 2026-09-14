import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, LogOut, Plus, Search, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { createElement } from '../lib/elements';
import { useCommandPalette } from './CommandPalette';
import { Logo } from './Logo';

// Sidebar persistante façon Notion plutôt qu'une barre du haut : la
// navigation (Dashboard, Corbeille, recherche, création) reste toujours au
// même endroit, quelle que soit la page. Icônes seules sous le breakpoint
// sm pour rester utilisable sur petit écran sans bascule JS.
export function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { open: openPalette } = useCommandPalette();

  const createMutation = useMutation({
    mutationFn: () => createElement({ name: 'Sans titre', family: 'ELEMENTS' }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      navigate(`/elements/${created.id}`, { state: { isNew: true } });
    },
  });

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { to: '/trash', label: 'Corbeille', icon: Trash2 },
  ];

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <aside className="flex w-16 shrink-0 flex-col border-r border-neutral-100 py-5 sm:w-56 sm:px-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-8 flex items-center justify-center gap-2 sm:justify-start"
        >
          <Logo size={26} />
          <span className="hidden text-base font-semibold tracking-tight text-neutral-900 sm:inline">
            Mycelium
          </span>
        </button>

        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="mb-1 flex items-center justify-center gap-2.5 rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-yellow-400 disabled:opacity-50 sm:justify-start"
        >
          <Plus size={16} strokeWidth={2} />
          <span className="hidden sm:inline">Nouvel Element</span>
        </button>

        <button
          onClick={openPalette}
          className="mb-6 flex items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 sm:justify-start"
        >
          <Search size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Rechercher</span>
          <span className="ml-auto hidden text-xs text-neutral-300 sm:inline">
            ⌘K
          </span>
        </button>

        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`flex items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-sm sm:justify-start ${
                  active
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                }`}
              >
                <item.icon size={16} strokeWidth={1.75} />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => signOut()}
          className="mt-auto flex items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 sm:justify-start"
        >
          <LogOut size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Se déconnecter</span>
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-3xl px-8 py-12">{children}</div>
      </main>
    </div>
  );
}
