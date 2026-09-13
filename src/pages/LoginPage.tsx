import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-8"
      >
        <h1 className="text-xl font-semibold tracking-tight">Mycelium</h1>
        <p className="text-sm text-neutral-400">
          Connecte-toi avec le compte créé dans ton projet Supabase.
        </p>
        <div className="space-y-1">
          <label className="text-sm text-neutral-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-yellow-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-neutral-400">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-yellow-500"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-yellow-500 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-yellow-400 disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
