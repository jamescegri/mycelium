import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTrashed, restoreElement } from '../lib/elements';
import { Layout } from '../components/Layout';

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
      <div className="mx-auto max-w-[56rem] px-6 py-10 sm:px-10">
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
            <span>{el.name}</span>
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
      </div>
    </Layout>
  );
}
