import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Une fois connecté (ou si on arrive sur /login avec une session déjà
  // active), on part vers l'app : rien dans le routing ne fait ce lien tout
  // seul, /login se contente d'afficher le formulaire.
  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-ink">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-surface-2 p-8"
      >
        <h1 className="text-xl font-semibold tracking-tight">Mycelium</h1>
        <p className="text-sm text-ink-2">
          Connecte-toi avec le compte créé dans ton projet Supabase.
        </p>
        <div className="space-y-1">
          <label className="text-sm text-ink-2">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-ink-2">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
