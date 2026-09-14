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
        <p className="text-sm text-ink-3">Chargement…</p>
      </Layout>
    );
  }

  if (!element) {
    return (
      <Layout>
        <p className="text-sm text-ink-3">Element introuvable.</p>
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
      <div className="mb-8 flex items-center justify-between gap-4">
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="shrink-0 transition hover:text-ink-2"
          >
            Dashboard
          </button>
          {parents[0] && (
            <>
              <ChevronRight size={13} strokeWidth={1.75} className="shrink-0 opacity-60" />
              <button
                onClick={() => navigate(`/elements/${parents[0].id}`)}
                className="max-w-[180px] truncate transition hover:text-ink-2"
              >
                {parents[0].name || 'Sans titre'}
              </button>
            </>
          )}
          {parents.length > 1 && (
            <span className="shrink-0 text-[11px] text-ink-4">
              +{parents.length - 1}
            </span>
          )}
          <ChevronRight size={13} strokeWidth={1.75} className="shrink-0 opacity-60" />
          <span className="truncate text-ink-2">{name || 'Sans titre'}</span>
        </nav>

        {/* Les actions vivent en haut à droite, comme dans Notion — elles ne
            coupent plus la zone d'écriture en deux. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            onClick={onRequestDelete}
            aria-label="Supprimer cet Element"
            className="rounded-lg p-1.5 text-ink-4 transition hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <span
        className="title-display mb-5 flex h-[60px] w-[60px] items-center justify-center rounded-2xl text-[26px]"
        style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
      >
        {(name || '?').charAt(0).toUpperCase()}
      </span>

      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sans titre"
        className="title-display w-full bg-transparent text-[46px] text-ink outline-none placeholder:text-ink-4"
      />

      <div
        className="mb-12 mt-3 text-[13px] font-medium tracking-wide opacity-90"
        style={{ color: FAMILY_COLOR[element.family] }}
      >
        {element.family === 'TIME' ? 'Temps' : 'Element'}
      </div>

      <div className="mb-12">
        <Editor elementId={element.id} content={content} onChange={setContent} />
      </div>

      {/* Le classement (Parents/Enfants) vit sous la zone de texte, jamais
          dedans : "@"/"+" tapés dans l'éditeur agissent ici, pas comme du
          texte inséré. */}
      <div className="space-y-8 border-t border-line-soft pt-10">
        <ParentsSection element={element} />
        <EnfantsSection element={element} />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line-soft pt-6">
        <ConnectionsDisclosure elementId={element.id} onSelect={openPeek} />
        <PropertiesDisclosure element={element} />
      </div>
    </>
  );
}
