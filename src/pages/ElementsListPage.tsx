import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listElements, createElement } from '../lib/elements';
import { FAMILIES } from '../types';
import type { ElementFamily } from '../types';
import { Layout } from '../components/Layout';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

export function ElementsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: elements, isLoading, error } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [family, setFamily] = useState<ElementFamily>('ELEMENTS');

  const createMutation = useMutation({
    mutationFn: createElement,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      setCreating(false);
      setName('');
      navigate(`/elements/${created.id}`);
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), family });
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Elements</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded bg-yellow-500 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-yellow-400"
        >
          + Nouvel Element
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
        >
          <input
            autoFocus
            placeholder="Nom de l'Element"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[180px] rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-yellow-500"
          />
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as ElementFamily)}
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-yellow-500"
          >
            {FAMILIES.map((f) => (
              <option key={f} value={f}>
                {FAMILY_LABEL[f]}
              </option>
            ))}
          </select>
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
      {error && (
        <p className="text-sm text-red-400">
          Erreur : {(error as Error).message}
        </p>
      )}

      <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
        {elements?.map((el) => (
          <li key={el.id}>
            <button
              onClick={() => navigate(`/elements/${el.id}`)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-900"
            >
              <span>{el.name}</span>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                {FAMILY_LABEL[el.family]}
              </span>
            </button>
          </li>
        ))}
        {elements?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">
            Aucun Element pour l'instant. Crée le premier ci-dessus.
          </li>
        )}
      </ul>
    </Layout>
  );
}
