import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getElement,
  softDeleteElement,
  updateElement,
} from '../lib/elements';
import { FAMILIES } from '../types';
import type { ElementFamily } from '../types';
import { Layout } from '../components/Layout';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

// Contenu texte simple en V1 de l'étape 2 : `content` est stocké tel quel
// (chaîne brute pour l'instant). L'étape 4 remplacera ceci par l'éditeur
// riche Tiptap et le système de mention "/", sans changer la colonne jsonb
// sous-jacente.
export function ElementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: element, isLoading } = useQuery({
    queryKey: ['elements', id],
    queryFn: () => getElement(id as string),
    enabled: !!id,
  });

  const [name, setName] = useState('');
  const [family, setFamily] = useState<ElementFamily>('ELEMENTS');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (element) {
      setName(element.name);
      setFamily(element.family);
      setContent(typeof element.content === 'string' ? element.content : '');
    }
  }, [element]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateElement(id as string, { name, family, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteElement(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      navigate('/elements');
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <p className="text-sm text-neutral-500">Chargement…</p>
      </Layout>
    );
  }

  if (!element) {
    return (
      <Layout>
        <p className="text-sm text-neutral-500">Element introuvable.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-transparent text-2xl font-semibold outline-none"
        />
        <select
          value={family}
          onChange={(e) => setFamily(e.target.value as ElementFamily)}
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
        >
          {FAMILIES.map((f) => (
            <option key={f} value={f}>
              {FAMILY_LABEL[f]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Écris librement…"
        rows={12}
        className="mb-6 w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm leading-relaxed outline-none focus:border-yellow-500"
      />

      <div className="flex items-center justify-between">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-yellow-400 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          onClick={() => {
            if (confirm(`Envoyer "${element.name}" à la corbeille ?`)) {
              deleteMutation.mutate();
            }
          }}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Supprimer
        </button>
      </div>

      <p className="mt-8 text-xs text-neutral-600">
        Hiérarchie, connexions, backlinks, tags et collections arrivent aux
        étapes suivantes du plan de développement.
      </p>
    </Layout>
  );
}
