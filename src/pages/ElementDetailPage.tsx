import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getElement,
  getElementsByIds,
  softDeleteElement,
  updateElement,
} from '../lib/elements';
import {
  createManualRelation,
  deleteRelation,
  listBacklinks,
  listManualRelations,
  syncMentionRelations,
} from '../lib/relations';
import { extractMentionIds, toEditorContent } from '../lib/content';
import { FAMILIES } from '../types';
import type { Element, ElementFamily, Relation } from '../types';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';
import { ElementPicker } from '../components/ElementPicker';

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

  const { data: manualRelations } = useQuery({
    queryKey: ['manual-relations', element.id],
    queryFn: async () => {
      const relations = await listManualRelations(element.id);
      const otherIds = [
        ...new Set(
          relations.map((r) =>
            r.source_id === element.id ? r.target_id : r.source_id
          )
        ),
      ];
      const others = await getElementsByIds(otherIds);
      const otherById = new Map(others.map((e) => [e.id, e]));
      return relations
        .map((relation) => ({
          relation,
          other: otherById.get(
            relation.source_id === element.id
              ? relation.target_id
              : relation.source_id
          ),
        }))
        .filter(
          (entry): entry is { relation: Relation; other: Element } =>
            !!entry.other
        );
    },
  });

  const [relationLabel, setRelationLabel] = useState('');
  const addRelationMutation = useMutation({
    mutationFn: (target: Element) =>
      createManualRelation(element.id, target.id, relationLabel),
    onSuccess: () => {
      setRelationLabel('');
      queryClient.invalidateQueries({
        queryKey: ['manual-relations', element.id],
      });
    },
  });
  const deleteRelationMutation = useMutation({
    mutationFn: (relationId: string) => deleteRelation(relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['manual-relations', element.id],
      });
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
          Relations
        </h2>
        {manualRelations && manualRelations.length > 0 && (
          <ul className="mb-3 divide-y divide-neutral-800 rounded-lg border border-neutral-800">
            {manualRelations.map(({ relation, other }) => (
              <li
                key={relation.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <button
                  onClick={() => navigate(`/elements/${other.id}`)}
                  className="flex-1 truncate text-left hover:underline"
                >
                  {relation.label && (
                    <span className="text-neutral-500">
                      {relation.label} ·{' '}
                    </span>
                  )}
                  {other.name}
                </button>
                <button
                  onClick={() => deleteRelationMutation.mutate(relation.id)}
                  aria-label="Supprimer la relation"
                  className="ml-3 shrink-0 text-neutral-600 hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <ElementPicker
            excludeId={element.id}
            placeholder="Relier à un Element…"
            onPick={(target) => addRelationMutation.mutate(target)}
          />
          <input
            value={relationLabel}
            onChange={(e) => setRelationLabel(e.target.value)}
            placeholder="Label (optionnel)"
            className="w-36 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
          />
        </div>
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
        Hiérarchie, tags, collections et timeline arrivent aux étapes
        suivantes du plan de développement.
      </p>
    </>
  );
}
