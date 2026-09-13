import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { ElementsListPage } from './pages/ElementsListPage';
import { ElementDetailPage } from './pages/ElementDetailPage';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-500">
        Chargement…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/elements"
        element={
          <RequireAuth>
            <ElementsListPage />
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
      <Route path="*" element={<Navigate to="/elements" replace />} />
    </Routes>
  );
}
