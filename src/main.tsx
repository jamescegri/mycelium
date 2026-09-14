import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { createQueryClient, persister } from './lib/offline'

// Le cache est recopié dans IndexedDB : l'app rouvre sur ses données même
// sans réseau. Et les écritures faites hors ligne, mises en attente par
// React Query, sont reprises ici dès que la connexion revient — y compris
// celles d'une session précédente, puisqu'elles ont été persistées avec le
// reste. Voir lib/offline.
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 1000 * 60 * 60 * 24 * 14,
            // Un changement de version invalide le cache : mieux vaut
            // repartir du serveur que réhydrater des données dans un
            // format que le code ne comprend plus.
            buster: 'v1',
          }}
          onSuccess={() => {
            void queryClient.resumePausedMutations();
          }}
        >
          <AuthProvider>
            <App />
          </AuthProvider>
        </PersistQueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
