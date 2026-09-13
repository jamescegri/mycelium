import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAncestors,
  getElement,
  listElements,
  softDeleteElement,
  sortByOrder,
  updateElement,
} from '../lib/elements';
import { syncMentionRelations } from '../lib/relations';
import { extractMentionIds, toEditorContent } from '../lib/content';
import { FAMILY_COLOR } from '../lib/family';
import type { Element } from '../types';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';
import { ConnectionsDisclosure } from '../components/ConnectionsDisclosure';
import { PropertiesDisclosure } from '../components/PropertiesDisclosure';
import { ChildrenList } from '../components/ChildrenList';
import { usePeek } from '../components/PeekPanel';

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
          mention) laisserait l'éditeur Tiptap afficher le contenu de l'ancien
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const { openPeek } = usePeek();

  const isNew = (location.state as { isNew?: boolean } | null)?.isNew;
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Focus + sélection au montage seulement : "+ Nouvelle sous-page" crée
  // l'Element "Sans titre" et amène directement ici, prêt à être renommé
  // sans clic supplémentaire.
  useEffect(() => {
    if (isNew) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState(element.name);
  const [content, setContent] = useState<object | string>(() =>
    toEditorContent(element.content)
  );

  const { data: allElements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const ancestors = allElements ? getAncestors(allElements, element.id) : [];
  const childElements = sortByOrder(
    (allElements ?? []).filter((e) => e.parent_id === element.id)
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const saved = await updateElement(element.id, { name, content });
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
      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sans titre"
        className="w-full bg-transparent text-3xl font-semibold tracking-tight text-neutral-900 outline-none placeholder:text-neutral-300"
      />

      <div className="mb-6 mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
        <button
          onClick={() => navigate(`/space/${element.family}`)}
          style={{ color: FAMILY_COLOR[element.family] }}
          className="hover:underline"
        >
          {element.family}
        </button>
        {ancestors.map((ancestor) => (
          <span key={ancestor.id} className="flex items-center gap-1.5">
            <span className="text-neutral-300">/</span>
            <button
              onClick={() => navigate(`/elements/${ancestor.id}`)}
              className="max-w-[160px] truncate hover:text-neutral-700"
            >
              {ancestor.name}
            </button>
          </span>
        ))}
      </div>

      <div className="mb-2">
        <PropertiesDisclosure element={element} />
      </div>

      <div className="mb-8">
        <Editor content={content} onChange={setContent} />
      </div>

      <div className="mb-10 flex items-center justify-between">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-yellow-400 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          onClick={onRequestDelete}
          className="text-sm text-red-600 hover:text-red-500"
        >
          Supprimer
        </button>
      </div>

      <div className="border-t border-neutral-100 pt-6">
        <ConnectionsDisclosure elementId={element.id} onSelect={openPeek} />
      </div>

      <div className="mt-8 border-t border-neutral-100 pt-6">
        <ChildrenList
          items={childElements}
          parentId={element.id}
          defaultFamily={element.family}
        />
      </div>
    </>
  );
}
