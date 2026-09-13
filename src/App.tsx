import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FamilyLevelPage } from './pages/FamilyLevelPage';
import { ElementDetailPage } from './pages/ElementDetailPage';
import { TrashPage } from './pages/TrashPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { PeekProvider } from './components/PeekPanel';
import { CommandPaletteProvider } from './components/CommandPalette';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
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
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/space/:family"
        element={
          <RequireAuth>
            <FamilyLevelPage />
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
      <Route
        path="/collections/:id"
        element={
          <RequireAuth>
            <CollectionDetailPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );

  // PeekPanel et CommandPalette n'ont de sens qu'authentifié (ils lisent les
  // Elements de l'utilisateur) : inutile de les monter sur /login.
  if (!session) return routes;

  return (
    <PeekProvider>
      <CommandPaletteProvider>{routes}</CommandPaletteProvider>
    </PeekProvider>
  );
}
