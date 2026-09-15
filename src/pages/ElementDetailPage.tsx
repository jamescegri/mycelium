import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Trash2 } from 'lucide-react';
import { getElement, listElements, softDeleteElement } from '../lib/elements';
import { MUTATION, type SaveElementInput } from '../lib/offline';
import { hasChildren, listAllLinks, parentsOf } from '../lib/links';
import { toEditorContent } from '../lib/content';
import { pastelFor } from '../lib/palette';
import { displayName } from '../lib/display';
import type { Element } from '../types';
import { Editor } from '../components/Editor';
import { ConnectionsDisclosure } from '../components/ConnectionsDisclosure';
import { PropertiesDisclosure } from '../components/PropertiesDisclosure';
import { ParentsSection } from '../components/ParentsSection';
import { EnfantsSection } from '../components/EnfantsSection';
import { ChronologySection } from '../components/ChronologySection';
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
          <p className="text-[17px] text-ink-3">Chargement…</p>
      );
  }

  if (!element) {
    return (
          <p className="text-[17px] text-ink-3">Element introuvable.</p>
      );
  }

  return (
      <div className="mx-auto max-w-[52rem] px-6 py-14 max-md:py-8 sm:px-14">
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
      </div>
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

  // Mutation nommée : hors ligne elle est mise en attente, survit à la
  // fermeture de l'app et repart au retour du réseau. Sa fonction vit dans
  // lib/offline, pour qu'elle reste rejouable quand cette page a disparu.
  const saveMutation = useMutation<Element, Error, SaveElementInput>({
    mutationKey: MUTATION.saveElement,
    onSuccess: () => {
      dirtyRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      queryClient.invalidateQueries({ queryKey: ['elements', element.id] });
    },
  });

  // Le texte est lu au moment de l'envoi, jamais capturé à la création de
  // la mutation : un enregistrement déclenché depuis un timeout ou depuis
  // le démontage écrirait sinon une version périmée.
  const save = () => {
    const current = latestRef.current;
    saveMutation.mutate({
      id: element.id,
      name: current.name,
      content: current.content,
    });
  };

  // Enregistrement automatique. Écrire puis cliquer sur une mention faisait
  // perdre le texte : il n'existait qu'un seul chemin de sauvegarde, le
  // bouton. Deux filets désormais — une pause de 800 ms dans la frappe, et
  // le démontage de la page (navigation vers un autre Element comprise).
  const dirtyRef = useRef(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
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

  // Le fil d'Ariane remonte toute la chaîne, pas seulement le parent
  // direct : à trois niveaux de profondeur, "Bloopers" seul ne dit pas
  // d'où l'on vient. On suit le premier parent à chaque étage — un
  // Element peut en avoir plusieurs, le "+n" le signale.
  const ancestors = useMemo(() => {
    if (!allElements || !allLinks) return [];
    const chain: Element[] = [];
    const seen = new Set<string>([element.id]);
    let current = parentsOf(allLinks, allElements, element.id)[0];
    while (current && !seen.has(current.id)) {
      chain.unshift(current);
      seen.add(current.id);
      current = parentsOf(allLinks, allElements, current.id)[0];
    }
    return chain;
  }, [allElements, allLinks, element.id]);

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
        <nav
          aria-label="Fil d'Ariane"
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] tracking-[0.06em] text-ink-4 uppercase"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="shrink-0 transition hover:text-ink"
          >
            Mon réseau
          </button>
          {ancestors.map((ancestor) => (
            <span key={ancestor.id} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={12} strokeWidth={2.2} className="shrink-0 opacity-60" />
              <button
                onClick={() => navigate(`/elements/${ancestor.id}`)}
                className="max-w-[150px] truncate transition hover:text-ink"
              >
                {displayName(ancestor)}
              </button>
            </span>
          ))}
          {parents.length > 1 && (
            <span className="shrink-0 normal-case">+{parents.length - 1}</span>
          )}
          <ChevronRight size={12} strokeWidth={2.2} className="shrink-0 opacity-60" />
          <span className="truncate font-semibold text-ink-2">
            {name || 'Sans titre'}
          </span>
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

      {/* Le classement est au-dessus du texte : en ouvrant un Element, on
          veut d'abord savoir où il se situe et à quoi il tient. "@"/"+"
          tapés dans l'éditeur agissent ici, pas comme du texte inséré. */}
      <div className="mt-5 border-b border-line pb-5">
        <PropertiesDisclosure element={element} />
        <ParentsSection element={element} />
        <EnfantsSection element={element} />
        <ChronologySection element={element} />
      </div>

      <div className="mt-7 mb-12">
        <Editor elementId={element.id} content={content} onChange={setContent} />
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-7">
        <ConnectionsDisclosure elementId={element.id} onSelect={openPeek} />
      </div>
    </>
  );
}
