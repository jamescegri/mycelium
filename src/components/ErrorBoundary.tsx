import { Component } from 'react';
import type { ReactNode } from 'react';

// Dernier filet : une exception pendant le rendu vide la page entière et ne
// laisse qu'un écran blanc, sans rien dans l'interface pour le dire. Ici au
// moins on sait que ça a cassé, et on peut repartir.
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Erreur de rendu :', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-[32rem]">
          <h1 className="title-display mb-3 text-[40px] text-ink">
            Quelque chose a cassé
          </h1>
          <p className="mb-5 text-[17px] text-ink-2">
            Rien n'est perdu en base — c'est l'affichage qui s'est arrêté.
          </p>
          <p className="mb-7 rounded-xl bg-surface-2 p-4 text-[14px] text-ink-3">
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-accent px-5 py-3 text-[15.5px] font-semibold text-white transition hover:bg-accent-hover"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
