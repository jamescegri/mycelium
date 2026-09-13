import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getElement,
  getElementsByIds,
  softDeleteElement,
  updateElement,
} from '../lib/elements';
import { listBacklinks, syncMentionRelations } from '../lib/relations';
import { extractMentionIds, toEditorContent } from '../lib/content';
import { FAMILIES } from '../types';
import type { Element, ElementFamily } from '../types';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';

const FAMILY_LABEL: Record<ElementFamily, string> = {
  TIME: 'Time',
  SPACE: 'Space',
  ELEMENTS: 'Elements',
};

export function ElementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: element, isLoading } = useQuery({
    queryKey: ['elements', id],
    queryFn: () => getElement(id as string),
    enabled: !!id,
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
      {/* key={element.id} : une instance fraîche par Element, avec son
          propre état local initialisé directement depuis les données déjà
          chargées. Sans ça, changer d'Element (ex. en cliquant sur une
          mention) laisserait l'éditeur Tiptap affiche le contenu de l'ancien
          Element, puisqu'il n'initialise son contenu qu'au montage. */}
      <ElementEditor
        key={element.id}
        element={element}
        onRequestDelete={() => {
          if (confirm(`Envoyer "${element.name}" à la corbeille ?`)) {
            deleteMutation.mutate();
          }
        }}
      />
    </Layout>
  );
}

function ElementEditor({
  element,
  onRequestDelete,
}: {
  element: Element;
  onRequestDelete: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(element.name);
  const [family, setFamily] = useState<ElementFamily>(element.family);
  const [content, setContent] = useState<object | string>(() =>
    toEditorContent(element.content)
  );

  const { data: backlinkElements } = useQuery({
    queryKey: ['backlinks', element.id],
    queryFn: async () => {
      const relations = await listBacklinks(element.id);
      const sourceIds = [...new Set(relations.map((r) => r.source_id))];
      return getElementsByIds(sourceIds);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const saved = await updateElement(element.id, { name, family, content });
      await syncMentionRelations(element.id, extractMentionIds(content));
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', element.id] });
    },
  });

  return (
    <>
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

      <div className="mb-6">
        <Editor content={content} onChange={setContent} />
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-yellow-400 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          onClick={onRequestDelete}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Supprimer
        </button>
      </div>

      <div className="mt-10 border-t border-neutral-800 pt-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Référencé par
        </h2>
        {!backlinkElements || backlinkElements.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Aucun Element ne mentionne celui-ci pour l'instant.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
            {backlinkElements.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => navigate(`/elements/${b.id}`)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-neutral-900"
                >
                  <span>{b.name}</span>
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                    {FAMILY_LABEL[b.family]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 text-xs text-neutral-600">
        Relations libres, hiérarchie, tags, collections et timeline arrivent
        aux étapes suivantes du plan de développement.
      </p>
    </>
  );
}
