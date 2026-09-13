import { useEffect, useRef } from 'react';
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from '@tiptap/suggestion';
import { MentionList } from './MentionList';
import type { MentionItem, MentionListHandle } from './MentionList';
import { createElement, searchElements } from '../lib/elements';
import { usePeek } from './PeekPanel';

interface EditorProps {
  content: string | object;
  onChange: (json: object) => void;
}

// Éditeur riche du contenu d'un Element. Le "/" ouvre une recherche
// d'Elements existants (ou propose d'en créer un à la volée) et insère un
// lien de type "mention" : c'est le mécanisme central de connexion entre
// idées demandé par le cahier des charges (pas de types narratifs imposés,
// juste des liens libres entre Elements).
export function Editor({ content, onChange }: EditorProps) {
  const { openPeek } = usePeek();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Écris librement… tape "/" pour lier un Element',
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
          items: async ({ query }) => {
            const results = await searchElements(query);
            const trimmed = query.trim();
            const hasExactMatch = results.some(
              (r) => r.name.toLowerCase() === trimmed.toLowerCase()
            );
            const items: MentionItem[] = results.map((r) => ({
              id: r.id,
              name: r.name,
            }));
            if (trimmed && !hasExactMatch) {
              items.push({ id: '__create__', name: trimmed, isCreate: true });
            }
            return items;
          },
          command: ({ editor: tiptapEditor, range, props }) => {
            const item = props as MentionItem;
            async function run() {
              let id = item.id;
              let label = item.name;
              if (item.isCreate) {
                const created = await createElement({
                  name: item.name,
                  family: 'ELEMENTS',
                });
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
          render: () => {
            let component: ReactRenderer<
              MentionListHandle,
              { items: MentionItem[]; command: (item: MentionItem) => void }
            >;
            let popup: TippyInstance[];

            return {
              onStart: (props: SuggestionProps<MentionItem>) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });
                if (!props.clientRect) return;
                popup = tippy('body', {
                  getReferenceClientRect: () =>
                    props.clientRect?.() ?? new DOMRect(),
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate(props: SuggestionProps<MentionItem>) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({
                  getReferenceClientRect: () =>
                    props.clientRect?.() ?? new DOMRect(),
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
          },
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'prose-mycelium min-h-[200px] text-[15px] leading-relaxed text-neutral-900 outline-none',
      },
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name === 'mention' && node.attrs.id) {
          openPeek(node.attrs.id);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: tiptapEditor }) => {
      onChangeRef.current(tiptapEditor.getJSON());
    },
  });

  return <EditorContent editor={editor} />;
}
