import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between px-6 py-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="font-semibold tracking-tight text-yellow-500"
        >
          Mycelium
        </button>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <button onClick={open} className="hover:text-neutral-300">
            Rechercher <span className="text-neutral-700">⌘K</span>
          </button>
          <button
            onClick={() => navigate('/trash')}
            className="hover:text-neutral-300"
          >
            Corbeille
          </button>
          <button onClick={() => signOut()} className="hover:text-neutral-300">
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
