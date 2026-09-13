// Le contenu d'un Element est stocké tel quel dans la colonne jsonb
// `content`. Historiquement (étape 2) c'était une simple chaîne de texte ;
// depuis l'éditeur Tiptap c'est un document JSON. Les deux cohabitent sans
// migration : on affiche l'un ou l'autre selon ce qui est en base.
export function toEditorContent(content: unknown): string | object {
  if (!content) return '';
  return content as string | object;
}

interface MentionLikeNode {
  type?: string;
  text?: string;
  attrs?: { id?: string; label?: string };
  content?: MentionLikeNode[];
}

// Aperçu texte brut pour le panneau latéral (peek) : pas besoin d'y monter
// un second éditeur Tiptap pour "juste comprendre" un Element avant
// d'éventuellement l'ouvrir en pleine page.
export function extractPlainText(content: unknown, maxLength = 240): string {
  let text = '';
  function walk(node: MentionLikeNode | null | undefined) {
    if (!node) return;
    if (typeof node.text === 'string') text += node.text;
    if (node.type === 'mention') text += node.attrs?.label ?? '';
    node.content?.forEach(walk);
    if (node.type === 'paragraph') text += ' ';
  }
  if (typeof content === 'string') {
    text = content;
  } else if (content) {
    walk(content as MentionLikeNode);
  }
  text = text.trim().replace(/\s+/g, ' ');
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}

export function extractMentionIds(doc: unknown): string[] {
  const ids: string[] = [];
  function walk(node: MentionLikeNode | null | undefined) {
    if (!node) return;
    if (node.type === 'mention' && node.attrs?.id) {
      ids.push(node.attrs.id);
    }
    node.content?.forEach(walk);
  }
  walk(doc as MentionLikeNode);
  return ids;
}
