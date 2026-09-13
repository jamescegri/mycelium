import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const NAV_ITEMS = [
  { to: '/elements', label: 'Elements' },
  { to: '/timeline', label: 'Timeline' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight text-yellow-500">
            Mycelium
          </span>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded px-3 py-1.5 text-sm ${
                  location.pathname.startsWith(item.to)
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-neutral-400 hover:text-neutral-200"
        >
          Se déconnecter
        </button>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
