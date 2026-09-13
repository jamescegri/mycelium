import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTrashed, restoreElement } from '../lib/elements';
import type { ElementFamily } from '../types';
import { Layout } from '../components/Layout';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

export function TrashPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: elements, isLoading } = useQuery({
    queryKey: ['trash'],
    queryFn: listTrashed,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreElement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['elements'] });
    },
  });

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Corbeille</h1>
        <button
          onClick={() => navigate('/elements')}
          className="text-sm text-neutral-400 hover:text-neutral-200"
        >
          ← Elements
        </button>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}

      <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
        {elements?.map((el) => (
          <li
            key={el.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span>{el.name}</span>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                {FAMILY_LABEL[el.family]}
              </span>
            </div>
            <button
              onClick={() => restoreMutation.mutate(el.id)}
              disabled={restoreMutation.isPending}
              className="text-sm text-yellow-500 hover:text-yellow-400 disabled:opacity-50"
            >
              Restaurer
            </button>
          </li>
        ))}
        {elements?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">
            La corbeille est vide.
          </li>
        )}
      </ul>
    </Layout>
  );
}
