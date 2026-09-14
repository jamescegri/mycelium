import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import { ImagePlus } from 'lucide-react';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionOptions } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from '@tiptap/suggestion';
import { MentionList } from './MentionList';
import type { MentionItem, MentionListHandle, TriggerChar } from './MentionList';
import { createElement, listElements, searchElements } from '../lib/elements';
import { linkChild, listAllLinks, wouldCreateCycle } from '../lib/links';
import { isUploadableImage, uploadImage } from '../lib/images';
import { reportError } from '../lib/errors';
import { usePeek } from './PeekPanel';
import type { Element, ElementLink } from '../types';

interface EditorProps {
  elementId: string;
  content: string | object;
  onChange: (json: object) => void;
}

async function mentionItems({ query }: { query: string }): Promise<MentionItem[]> {
  const results = await searchElements(query);
  const trimmed = query.trim();
  const hasExactMatch = results.some(
    (r) => r.name.toLowerCase() === trimmed.toLowerCase()
  );
  const items: MentionItem[] = results.map((r) => ({ id: r.id, name: r.name }));
  if (trimmed && !hasExactMatch) {
    items.push({ id: '__create__', name: trimmed, isCreate: true });
  }
  return items;
}

// Popup partagé par les trois déclencheurs ("/", "@", "+") : même liste,
// même recherche, même "+ Créer" — seul ce qui se passe au choix diffère.
// Sans texte tapé, le popup permet aussi de parcourir les Groupes en
// profondeur (getBrowseData fournit toujours les données les plus
// fraîches, lues au moment où le popup s'ouvre, pas au moment où
// l'extension a été créée).
function suggestionRender(
  getBrowseData: () => { elements: Element[]; links: ElementLink[] },
  trigger: TriggerChar
): SuggestionOptions<MentionItem>['render'] {
  return () => {
    let component: ReactRenderer<
      MentionListHandle,
      {
        items: MentionItem[];
        command: (item: MentionItem) => void;
        query: string;
        browse?: { elements: Element[]; links: ElementLink[] };
        trigger?: TriggerChar;
      }
    >;
    let popup: TippyInstance[];

    return {
      onStart: (props: SuggestionProps<MentionItem>) => {
        component = new ReactRenderer(MentionList, {
          props: { ...props, browse: getBrowseData(), trigger },
          editor: props.editor,
        });
        if (!props.clientRect) return;
        popup = tippy('body', {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },
      onUpdate(props: SuggestionProps<MentionItem>) {
        component.updateProps({ ...props, browse: getBrowseData(), trigger });
        if (!props.clientRect) return;
        popup[0].setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
        });
      },
      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  };
}

// "@" et "+" ne sont pas des insertions de texte : ce sont des actions sur
// le rangement de l'Element (Parents/Enfants), qui se voient sur la page
// sous l'éditeur — jamais dans le texte lui-même. On efface donc le
// "@query"/"+query" tapé au lieu d'y insérer quoi que ce soit.
function createStructuralTrigger(
  name: string,
  char: TriggerChar,
  onPick: (pickedId: string) => void | Promise<void>,
  getBrowseData: () => { elements: Element[]; links: ElementLink[] }
) {
  return Extension.create({
    name,
    addProseMirrorPlugins() {
      return [
        Suggestion<MentionItem>({
          editor: this.editor,
          pluginKey: new PluginKey(name),
          char,
          allowSpaces: true,
          items: mentionItems,
          command: ({ editor: tiptapEditor, range, props }) => {
            const item = props as MentionItem;
            async function run() {
              let id = item.id;
              if (item.isCreate) {
                const created = await createElement({ name: item.name });
                id = created.id;
              }
              tiptapEditor.chain().focus().deleteRange(range).run();
              await onPick(id);
            }
            void run();
          },
          render: suggestionRender(getBrowseData, char),
        }),
      ];
    },
  });
}

// Éditeur riche du contenu d'un Element.
// "/" cherche/crée un Element et insère un lien cliquable dans le texte.
// "@" rattache l'Element courant comme enfant de celui choisi (celui-ci
// devient un parent). "+" rattache l'Element choisi comme enfant de
// l'Element courant. Ni "@" ni "+" n'insèrent quoi que ce soit dans le
// texte — l'effet se voit dans les sections Parents/Enfants de la page.
export function Editor({ elementId, content, onChange }: EditorProps) {
  const { openPeek } = usePeek();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Lus au moment où le popup "/"/"@"/"+" s'ouvre (pas au moment où
  // l'éditeur a été créé) : les refs restent à jour même si ces données
  // arrivent ou changent après le premier rendu.
  const { data: allElements } = useQuery({
    queryKey: ['elements'],
    queryFn: listElements,
  });
  const { data: allLinks } = useQuery({
    queryKey: ['links'],
    queryFn: listAllLinks,
  });
  const elementsRef = useRef<Element[]>([]);
  const linksRef = useRef<ElementLink[]>([]);
  useEffect(() => {
    elementsRef.current = allElements ?? [];
  }, [allElements]);
  useEffect(() => {
    linksRef.current = allLinks ?? [];
  }, [allLinks]);
  const getBrowseData = () => ({
    elements: elementsRef.current,
    links: linksRef.current,
  });

  async function attachAsChildOf(parentId: string) {
    const links = await queryClient.ensureQueryData({
      queryKey: ['links'],
      queryFn: listAllLinks,
    });
    if (wouldCreateCycle(links, parentId, elementId)) return;
    await linkChild(parentId, elementId);
    queryClient.invalidateQueries({ queryKey: ['links'] });
  }
  async function attachChild(childId: string) {
    const links = await queryClient.ensureQueryData({
      queryKey: ['links'],
      queryFn: listAllLinks,
    });
    if (wouldCreateCycle(links, elementId, childId)) return;
    await linkChild(elementId, childId);
    queryClient.invalidateQueries({ queryKey: ['links'] });
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      // Les images sont envoyées au stockage et n'entrent dans le document
      // que par leur URL — voir lib/images.
      Image.configure({
        HTMLAttributes: { class: 'element-image' },
      }),
      Placeholder.configure({
        placeholder:
          'Écris librement… "/" pour lier, "@" pour un parent, "+" pour un enfant',
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderText: ({ node }) => String(node.attrs.label ?? node.attrs.id),
        renderHTML: ({ node }) => [
          'span',
          { class: 'mention', 'data-id': node.attrs.id },
          String(node.attrs.label ?? node.attrs.id),
        ],
        suggestion: {
          char: '/',
          allowSpaces: true,
          items: mentionItems,
          command: ({ editor: tiptapEditor, range, props }) => {
            const item = props as MentionItem;
            async function run() {
              let id = item.id;
              let label = item.name;
              if (item.isCreate) {
                const created = await createElement({ name: item.name });
                id = created.id;
                label = created.name;
              }
              tiptapEditor
                .chain()
                .focus()
                .insertContentAt(range, [
                  {
                    type: 'mention',
                    attrs: { id, label, mentionSuggestionChar: '/' },
                  },
                  { type: 'text', text: ' ' },
                ])
                .run();
            }
            void run();
          },
          render: suggestionRender(getBrowseData, '/'),
        },
      }),
      createStructuralTrigger(
        'mentionParent',
        '@',
        attachAsChildOf,
        getBrowseData
      ),
      createStructuralTrigger('mentionChild', '+', attachChild, getBrowseData),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'prose-mycelium min-h-[260px] text-[17px] leading-[1.65] text-ink outline-none',
      },
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name === 'mention' && node.attrs.id) {
          openPeek(node.attrs.id);
          return true;
        }
        return false;
      },
      // Déposer une image dans le texte, ou la coller depuis le presse-
      // papier : c'est le geste qu'on fait naturellement, bien avant de
      // chercher un bouton.
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        const images = files.filter(isUploadableImage);
        if (images.length === 0) return false;
        event.preventDefault();
        void insertImages(images);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        const images = files.filter(isUploadableImage);
        if (images.length === 0) return false;
        event.preventDefault();
        void insertImages(images);
        return true;
      },
    },
    onUpdate: ({ editor: tiptapEditor }) => {
      onChangeRef.current(tiptapEditor.getJSON());
    },
  });

  // Les envois se suivent plutôt que de partir ensemble : à cinq planches
  // lâchées d'un coup, les lancer en parallèle sature la connexion et les
  // images arrivent dans le désordre.
  async function insertImages(files: File[]) {
    setUploading(true);
    try {
      for (const file of files) {
        const src = await uploadImage(file);
        editorRef.current
          ?.chain()
          .focus()
          .setImage({ src, alt: file.name })
          .run();
      }
    } catch (error) {
      reportError(error);
    } finally {
      setUploading(false);
    }
  }

  // `handleDrop` et `handlePaste` sont figés à la création de l'éditeur :
  // sans cette référence, ils appelleraient toujours la première instance.
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  return (
    <div>
      <EditorContent editor={editor} />

      <div className="mt-3 flex items-center gap-3 border-t border-line-soft pt-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-ink-3 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <ImagePlus size={14} strokeWidth={2} />
          {uploading ? 'Envoi…' : 'Ajouter une image'}
        </button>
        <span className="text-[12.5px] text-ink-4">
          ou dépose-la dans le texte
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])].filter(isUploadableImage);
            if (files.length > 0) void insertImages(files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
