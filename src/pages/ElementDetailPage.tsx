import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Trash2 } from 'lucide-react';
import { getElement, listElements, softDeleteElement, updateElement } from '../lib/elements';
import { hasChildren, listAllLinks, parentsOf } from '../lib/links';
import { syncMentionRelations } from '../lib/relations';
import { extractMentionIds, toEditorContent } from '../lib/content';
import { FAMILY_COLOR, FAMILY_LABEL } from '../lib/family';
import { pastelFor } from '../lib/palette';
import { displayName } from '../lib/display';
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
        <p className="text-[17px] text-ink-3">Chargement…</p>
      </Layout>
    );
  }

  if (!element) {
    return (
      <Layout>
        <p className="text-[17px] text-ink-3">Element introuvable.</p>
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

  // La sauvegarde lit toujours latestRef, jamais les variables d'état
  // capturées à la création de la mutation : un enregistrement déclenché
  // depuis un timeout ou depuis le démontage écrirait sinon une version
  // périmée du texte.
  const latestRef = useRef({ name, content });
  useEffect(() => {
    latestRef.current = { name, content };
  }, [name, content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const current = latestRef.current;
      const saved = await updateElement(element.id, {
        name: current.name,
        content: current.content,
      });
      await syncMentionRelations(
        element.id,
        extractMentionIds(current.content)
      );
      return saved;
    },
    onSuccess: () => {
      dirtyRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', element.id] });
    },
  });

  // Enregistrement automatique. Écrire puis cliquer sur une mention faisait
  // perdre le texte : il n'existait qu'un seul chemin de sauvegarde, le
  // bouton. Deux filets désormais — une pause de 800 ms dans la frappe, et
  // le démontage de la page (navigation vers un autre Element comprise).
  const dirtyRef = useRef(false);
  const saveRef = useRef(saveMutation.mutate);
  useEffect(() => {
    saveRef.current = saveMutation.mutate;
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    dirtyRef.current = true;
    const timer = setTimeout(() => saveRef.current(), 800);
    return () => clearTimeout(timer);
  }, [name, content]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) saveRef.current();
    };
  }, []);

  // Fermeture d'onglet ou rechargement pendant la fenêtre de 800 ms : on
  // prévient plutôt que de laisser filer.
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

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

  // La pastille n'est fluo que si l'Element est un Groupe (il a au moins un
  // enfant) — et c'est alors exactement la teinte de sa carte sur le
  // Dashboard. Un Element sans enfant reste en gris : voir de la couleur
  // veut dire "ceci regroupe des choses", jamais "ceci est un Element".
  const isGroup = allLinks ? hasChildren(allLinks, element.id) : false;
  const avatarColors = isGroup
    ? pastelFor(element.id)
    : { bg: 'var(--color-surface-3)', text: 'var(--color-ink-2)' };

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <nav className="flex min-w-0 items-center gap-2 text-[15px] text-ink-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="shrink-0 transition hover:text-ink-2"
          >
            Dashboard
          </button>
          {parents[0] && (
            <>
              <ChevronRight size={15} strokeWidth={2} className="shrink-0 opacity-60" />
              <button
                onClick={() => navigate(`/elements/${parents[0].id}`)}
                className="max-w-[180px] truncate transition hover:text-ink-2"
              >
                {displayName(parents[0])}
              </button>
            </>
          )}
          {parents.length > 1 && (
            <span className="shrink-0 text-[13px] text-ink-4">
              +{parents.length - 1}
            </span>
          )}
          <ChevronRight size={15} strokeWidth={2} className="shrink-0 opacity-60" />
          <span className="truncate text-ink-2">{name || 'Sans titre'}</span>
        </nav>

        {/* Plus de bouton "Enregistrer" : l'enregistrement est automatique,
            il ne reste qu'à dire où il en est. */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            aria-live="polite"
            className="text-[14px] text-ink-4 transition"
          >
            {saveMutation.isPending
              ? 'Enregistrement…'
              : saveMutation.isSuccess
                ? 'Enregistré'
                : ''}
          </span>
          <button
            onClick={onRequestDelete}
            aria-label="Supprimer cet Element"
            className="rounded-xl p-2 text-ink-4 transition hover:bg-surface-3 hover:text-ink"
          >
            <Trash2 size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <span
        className="title-display mb-6 flex h-[68px] w-[68px] items-center justify-center rounded-2xl text-[32px]"
        style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
      >
        {(name || '?').charAt(0).toUpperCase()}
      </span>

      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sans titre"
        className="title-display w-full bg-transparent text-[62px] text-ink outline-none placeholder:text-ink-4"
      />

      <div
        className="mb-14 mt-4 text-[15px] font-medium"
        style={{ color: FAMILY_COLOR[element.family] }}
      >
        {FAMILY_LABEL[element.family]}
      </div>

      <div className="mb-14">
        <Editor elementId={element.id} content={content} onChange={setContent} />
      </div>

      {/* Le classement (Parents/Enfants) vit sous la zone de texte, jamais
          dedans : "@"/"+" tapés dans l'éditeur agissent ici, pas comme du
          texte inséré. */}
      <div className="space-y-10 border-t border-line pt-12">
        <ParentsSection element={element} />
        <EnfantsSection element={element} />
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-7">
        <ConnectionsDisclosure elementId={element.id} onSelect={openPeek} />
        <PropertiesDisclosure element={element} />
      </div>
    </>
  );
}
