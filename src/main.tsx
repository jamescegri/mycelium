import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { reportError } from './lib/errors'
import { ErrorBoundary } from './components/ErrorBoundary'

// Toute requête ou écriture qui échoue remonte ici. Sans ça, une table
// manquante ou un refus RLS donnait exactement le même écran qu'un dossier
// vide, et on cherchait l'erreur de son côté.
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportError }),
  mutationCache: new MutationCache({ onError: reportError }),
  defaultOptions: {
    queries: {
      // Par défaut React Query réessaie trois fois avec un délai croissant :
      // une table absente ou un refus RLS mettrait sept secondes à
      // s'afficher. Ces erreurs-là ne se réparent pas en réessayant, on les
      // montre tout de suite. Seules les pannes réseau valent un second essai.
      retry: (failureCount, error) => {
        const code = (error as { code?: unknown } | null)?.code;
        if (typeof code === 'string' && code) return false;
        return failureCount < 1;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
