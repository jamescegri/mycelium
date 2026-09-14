import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ElementDetailPage } from './pages/ElementDetailPage';
import { TagsPage } from './pages/TagsPage';
import { TrashPage } from './pages/TrashPage';
import { Layout } from './components/Layout';
import { HomeView } from './components/HomeView';
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

      {/* Le Layout enveloppe les routes au lieu d'être rendu par chacune :
          il survit ainsi aux changements de page, et avec lui l'endroit où
          l'on se trouve dans l'explorateur. Quand chaque page rendait son
          propre Layout, ouvrir un Element le démontait et ramenait la
          colonne à la racine. */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<HomeView />} />
        {/* Sur Groupes, l'explorateur du Layout est toute la vue : cette
            route n'a rien à afficher à côté. */}
        <Route path="/groupes" element={null} />
        {/* Ces trois angles partagent la même page : ce sont des façons de
            regarder le même réseau, pas trois bases de données. */}
        {['/liste', '/temporel', '/connexions'].map((path) => (
          <Route key={path} path={path} element={<DashboardPage />} />
        ))}
        {/* Les Tags ont une route à eux, mais pas de page par Tag : un Tag
            n'a ni contenu ni enfants. "?tag=" est un filtre sur la liste,
            pas l'adresse d'un objet. */}
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/elements/:id" element={<ElementDetailPage />} />
        <Route path="/trash" element={<TrashPage />} />
      </Route>

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
