import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addElementToCollection,
  deleteCollection,
  getCollection,
  listElementsInCollection,
  removeElementFromCollection,
} from '../lib/collections';
import { Layout } from '../components/Layout';
import { ElementPicker } from '../components/ElementPicker';
import type { ElementFamily } from '../types';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: collection, isLoading } = useQuery({
    queryKey: ['collections', id],
    queryFn: () => getCollection(id as string),
    enabled: !!id,
  });

  const { data: elements } = useQuery({
    queryKey: ['collection-elements', id],
    queryFn: () => listElementsInCollection(id as string),
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: (elementId: string) =>
      addElementToCollection(elementId, collection?.name ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-elements', id] });
    },
  });
  const removeMutation = useMutation({
    mutationFn: (elementId: string) =>
      removeElementFromCollection(id as string, elementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-elements', id] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteCollection(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      navigate('/dashboard');
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <p className="text-sm text-neutral-500">Chargement…</p>
      </Layout>
    );
  }

  if (!collection) {
    return (
      <Layout>
        <p className="text-sm text-neutral-500">Collection introuvable.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-4 text-xs text-neutral-500 hover:text-neutral-700"
      >
        ← Dashboard
      </button>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{collection.name}</h1>
        <button
          onClick={() => {
            if (confirm(`Supprimer la collection "${collection.name}" ?`)) {
              deleteMutation.mutate();
            }
          }}
          className="text-sm text-red-600 hover:text-red-500"
        >
          Supprimer
        </button>
      </div>

      <div className="mb-4">
        <ElementPicker
          excludeIds={(elements ?? []).map((e) => e.id)}
          placeholder="Ajouter un Element…"
          onPick={(picked) => addMutation.mutate(picked.id)}
        />
      </div>

      <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-200">
        {elements?.map((el) => (
          <li
            key={el.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <button
              onClick={() => navigate(`/elements/${el.id}`)}
              className="flex-1 text-left hover:underline"
            >
              {el.name}
            </button>
            <span className="mr-3 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {FAMILY_LABEL[el.family]}
            </span>
            <button
              onClick={() => removeMutation.mutate(el.id)}
              aria-label="Retirer de la collection"
              className="text-neutral-400 hover:text-red-600"
            >
              ×
            </button>
          </li>
        ))}
        {elements?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">
            Aucun Element dans cette collection pour l'instant.
          </li>
        )}
      </ul>
    </Layout>
  );
}
