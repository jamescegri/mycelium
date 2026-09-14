import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useCommandPalette } from './CommandPalette';

// Nav minimale à dessein : le Dashboard héberge déjà les quatre angles
// d'exploration (Arborescence/Temporel/Connexions/Collections), donc rien
// ici ne doit rivaliser avec lui comme destination de nav principale.
export function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { open } = useCommandPalette();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="flex items-center justify-between px-8 py-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-semibold tracking-tight text-yellow-500"
        >
          Mycelium
        </button>
        <div className="flex items-center gap-5 text-sm text-neutral-500">
          <button
            onClick={open}
            className="flex items-center gap-1.5 hover:text-neutral-700"
          >
            <Search size={15} strokeWidth={1.75} />
            Rechercher <span className="text-neutral-300">⌘K</span>
          </button>
          <button
            onClick={() => navigate('/trash')}
            className="flex items-center gap-1.5 hover:text-neutral-700"
          >
            <Trash2 size={15} strokeWidth={1.75} />
            Corbeille
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 hover:text-neutral-700"
          >
            <LogOut size={15} strokeWidth={1.75} />
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-8 py-12">{children}</main>
    </div>
  );
}
