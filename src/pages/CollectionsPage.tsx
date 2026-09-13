import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCollection, listCollections } from '../lib/collections';
import { Layout } from '../components/Layout';

export function CollectionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
  });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setCreating(false);
      setName('');
      navigate(`/collections/${created.id}`);
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(name.trim());
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Collections</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded bg-yellow-500 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-yellow-400"
        >
          + Nouvelle collection
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-6 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <input
            autoFocus
            placeholder="Nom de la collection"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-yellow-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
          >
            Créer
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}

      <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
        {collections?.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => navigate(`/collections/${c.id}`)}
              className="flex w-full items-center px-4 py-3 text-left hover:bg-neutral-900"
            >
              {c.name}
            </button>
          </li>
        ))}
        {collections?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">
            Aucune collection pour l'instant.
          </li>
        )}
      </ul>
    </Layout>
  );
}
