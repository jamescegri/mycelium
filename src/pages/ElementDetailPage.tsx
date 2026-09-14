import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Trash2 } from 'lucide-react';
import { getElement, listElements, softDeleteElement, updateElement } from '../lib/elements';
import { listAllLinks, parentsOf } from '../lib/links';
import { syncMentionRelations } from '../lib/relations';
import { extractMentionIds, toEditorContent } from '../lib/content';
import { FAMILY_COLOR } from '../lib/family';
import { pastelFor } from '../lib/palette';
import type { Element } from '../types';
import { Layout } from '../components/Layout';
import { Editor } from '../components/Editor';
import { ConnectionsDisclosure } from '../components/ConnectionsDisclosure';
import { PropertiesDisclosure } from '../components/PropertiesDisclosure';
import { ParentsSection } from '../components/ParentsSection';
import { EnfantsSection } from '../components/EnfantsSection';
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

  const avatarColors = pastelFor(element.id);

  const { data: allElements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: allLinks } = useQuery({
    queryKey: ['links'],
    queryFn: listAllLinks,
  });
  const navigate = useNavigate();
  const parents =
    allElements && allLinks ? parentsOf(allLinks, allElements, element.id) : [];

  return (
    <>
      <nav className="mb-6 flex items-center gap-1 text-sm text-neutral-400">
        <button
          onClick={() => navigate('/dashboard')}
          className="hover:text-neutral-600"
        >
          Dashboard
        </button>
        {parents[0] && (
          <>
            <ChevronRight size={14} strokeWidth={1.75} />
            <button
              onClick={() => navigate(`/elements/${parents[0].id}`)}
              className="max-w-[200px] truncate hover:text-neutral-600"
            >
              {parents[0].name || 'Sans titre'}
            </button>
          </>
        )}
        {parents.length > 1 && (
          <span className="text-xs text-neutral-300">+{parents.length - 1}</span>
        )}
        <ChevronRight size={14} strokeWidth={1.75} />
        <span className="max-w-[200px] truncate text-neutral-600">
          {name || 'Sans titre'}
        </span>
      </nav>

      <span
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold"
        style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
      >
        {(name || '?').charAt(0).toUpperCase()}
      </span>

      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sans titre"
        className="w-full bg-transparent text-5xl font-semibold tracking-tight text-neutral-900 outline-none placeholder:text-neutral-300"
      />

      <div
        className="mb-8 mt-2 text-sm font-medium tracking-wide"
        style={{ color: FAMILY_COLOR[element.family] }}
      >
        {element.family}
      </div>

      <div className="mb-8">
        <Editor elementId={element.id} content={content} onChange={setContent} />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded bg-yellow-500 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-yellow-400 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          onClick={onRequestDelete}
          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-500"
        >
          <Trash2 size={14} strokeWidth={1.75} />
          Supprimer
        </button>
      </div>

      {/* Le classement (Parents/Enfants) vit sous la zone de texte, jamais
          dedans : "@"/"+" tapés dans l'éditeur agissent ici, pas comme du
          texte inséré. */}
      <div className="mb-6 space-y-4 border-t border-neutral-100 pt-6">
        <ParentsSection element={element} />
        <EnfantsSection element={element} />
      </div>

      <div className="mb-6">
        <PropertiesDisclosure element={element} />
      </div>

      <div className="border-t border-neutral-100 pt-6">
        <ConnectionsDisclosure elementId={element.id} onSelect={openPeek} />
      </div>
    </>
  );
}
