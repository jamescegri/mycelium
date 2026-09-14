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
    mutationFn: () => createElement({ name: '', family: 'ELEMENTS' }),
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
    <div className="flex min-h-screen bg-surface text-ink">
      <aside className="flex w-[68px] shrink-0 flex-col gap-1 border-r border-line-soft bg-surface-2 px-3 py-6 sm:w-[252px] sm:px-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-9 flex items-center justify-center gap-2.5 px-1 sm:justify-start"
        >
          <Logo size={28} />
          <span className="title-display hidden text-[25px] text-ink sm:inline">
            Mycelium
          </span>
        </button>

        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="flex items-center justify-center gap-2.5 rounded-xl bg-accent px-3.5 py-3 text-[15.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 sm:justify-start"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span className="hidden sm:inline">Nouvel Element</span>
        </button>

        <button
          onClick={openPalette}
          className="mb-8 flex items-center justify-center gap-2.5 rounded-xl px-3.5 py-3 text-[15.5px] text-ink-3 transition hover:bg-surface-3 hover:text-ink sm:justify-start"
        >
          <Search size={18} strokeWidth={2} />
          <span className="hidden sm:inline">Rechercher</span>
          <span className="ml-auto hidden text-[13px] text-ink-4 sm:inline">
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
                className={`flex items-center justify-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[15.5px] transition sm:justify-start ${
                  active
                    ? 'bg-surface-3 font-semibold text-ink'
                    : 'text-ink-3 hover:bg-surface-3 hover:text-ink'
                }`}
              >
                <item.icon size={18} strokeWidth={2} />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => signOut()}
          className="mt-auto flex items-center justify-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[15.5px] text-ink-4 transition hover:bg-surface-3 hover:text-ink-2 sm:justify-start"
        >
          <LogOut size={18} strokeWidth={2} />
          <span className="hidden sm:inline">Se déconnecter</span>
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[50rem] px-6 py-16 sm:px-14">
          {children}
        </div>
      </main>
    </div>
  );
}
