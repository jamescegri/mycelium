import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ElementDetailPage } from './pages/ElementDetailPage';
import { TagsPage } from './pages/TagsPage';
import { TrashPage } from './pages/TrashPage';
import { PeekProvider } from './components/PeekPanel';
import { CommandPaletteProvider } from './components/CommandPalette';
import { Toaster } from './components/Toaster';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-ink-3">
        Chargement…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { session } = useAuth();

  const routes = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Les quatre angles partagent la même page : ce sont des façons de
          regarder le même réseau, pas quatre bases de données séparées. */}
      {['/dashboard', '/groupes', '/liste', '/temporel', '/connexions'].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
      ))}
      {/* Les Tags ont une route à eux, mais pas de page par Tag : un Tag
          n'a ni contenu ni enfants. "?tag=" est un filtre sur la liste,
          pas l'adresse d'un objet. */}
      <Route
        path="/tags"
        element={
          <RequireAuth>
            <TagsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/elements/:id"
        element={
          <RequireAuth>
            <ElementDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trash"
        element={
          <RequireAuth>
            <TrashPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );

  // PeekPanel et CommandPalette n'ont de sens qu'authentifié (ils lisent les
  // Elements de l'utilisateur) : inutile de les monter sur /login.
  if (!session) {
    return (
      <>
        {routes}
        <Toaster />
      </>
    );
  }

  return (
    <PeekProvider>
      <CommandPaletteProvider>{routes}</CommandPaletteProvider>
      <Toaster />
    </PeekProvider>
  );
}
