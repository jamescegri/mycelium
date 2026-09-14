import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTrashed, restoreElement } from '../lib/elements';
import type { ElementFamily } from '../types';
import { Layout } from '../components/Layout';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Temps',
  ELEMENTS: 'Element',
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
          onClick={() => navigate('/dashboard')}
          className="text-[16px] text-ink-2 hover:text-ink"
        >
          ← Dashboard
        </button>
      </div>

      {isLoading && <p className="text-[16px] text-ink-3">Chargement…</p>}

      <ul className="divide-y divide-line rounded-lg border border-line">
        {elements?.map((el) => (
          <li
            key={el.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span>{el.name}</span>
              <span className="rounded bg-surface-3 px-2 py-0.5 text-[13.5px] text-ink-2">
                {FAMILY_LABEL[el.family]}
              </span>
            </div>
            <button
              onClick={() => restoreMutation.mutate(el.id)}
              disabled={restoreMutation.isPending}
              className="text-[16px] text-accent hover:text-accent-hover disabled:opacity-50"
            >
              Restaurer
            </button>
          </li>
        ))}
        {elements?.length === 0 && (
          <li className="px-4 py-6 text-center text-[16px] text-ink-3">
            La corbeille est vide.
          </li>
        )}
      </ul>
    </Layout>
  );
}
