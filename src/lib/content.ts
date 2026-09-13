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
  attrs?: { id?: string };
  content?: MentionLikeNode[];
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
