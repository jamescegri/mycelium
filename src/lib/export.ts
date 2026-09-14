import { childrenOf, parentsOf } from './links';
import { displayName } from './display';
import type { Element, ElementLink, Tag } from '../types';

// Sortir son univers du logiciel. Un auteur ne devrait jamais avoir à se
// demander ce qu'il advient de dix ans de notes si l'app disparaît — et
// relire son récit ailleurs, dans un traitement de texte ou sur liseuse,
// est un usage à part entière.
//
// Le Markdown plutôt qu'un format à nous : il s'ouvre partout, se lit
// même brut, et survivra à ce code.

interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: Node[];
}

function applyMarks(text: string, marks: { type: string }[] = []): string {
  let out = text;
  for (const mark of marks) {
    if (mark.type === 'bold') out = `**${out}**`;
    else if (mark.type === 'italic') out = `*${out}*`;
    else if (mark.type === 'strike') out = `~~${out}~~`;
    else if (mark.type === 'code') out = `\`${out}\``;
  }
  return out;
}

function inline(nodes: Node[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === 'mention') {
        // Une mention devient le nom entre crochets : on garde la trace du
        // lien sans inventer une URL qui ne mènerait nulle part hors de
        // l'app.
        return `[[${String(node.attrs?.label ?? node.attrs?.id ?? '')}]]`;
      }
      if (node.type === 'hardBreak') return '\n';
      if (typeof node.text === 'string') {
        return applyMarks(node.text, node.marks);
      }
      return inline(node.content);
    })
    .join('');
}

function blocks(nodes: Node[] = [], depth = 0): string[] {
  const out: string[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph': {
        const text = inline(node.content);
        if (text.trim()) out.push(text);
        break;
      }
      case 'heading': {
        const level = Number(node.attrs?.level ?? 1);
        out.push(`${'#'.repeat(Math.min(6, level))} ${inline(node.content)}`);
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const ordered = node.type === 'orderedList';
        node.content?.forEach((item, i) => {
          const marker = ordered ? `${i + 1}.` : '-';
          const inner = blocks(item.content, depth + 1);
          const pad = '  '.repeat(depth);
          out.push(
            inner
              .map((line, j) => (j === 0 ? `${pad}${marker} ${line}` : `${pad}  ${line}`))
              .join('\n')
          );
        });
        break;
      }
      case 'blockquote':
        out.push(
          blocks(node.content, depth)
            .map((line) => `> ${line}`)
            .join('\n> \n')
        );
        break;
      case 'codeBlock':
        out.push(`\`\`\`\n${inline(node.content)}\n\`\`\``);
        break;
      case 'image':
        out.push(
          `![${String(node.attrs?.alt ?? '')}](${String(node.attrs?.src ?? '')})`
        );
        break;
      case 'horizontalRule':
        out.push('---');
        break;
      default:
        if (node.content) out.push(...blocks(node.content, depth));
    }
  }

  return out;
}

export function contentToMarkdown(content: unknown): string {
  if (!content) return '';
  // Les Elements d'avant l'éditeur riche stockaient du texte brut.
  if (typeof content === 'string') return content;
  return blocks((content as Node).content).join('\n\n');
}

// Un seul fichier plutôt qu'une archive : on veut pouvoir le relire d'une
// traite, et l'imbrication du récit est rendue par les niveaux de titre.
export function universeToMarkdown(
  elements: Element[],
  links: ElementLink[],
  tags: Tag[],
  elementTags: { element_id: string; tag_id: string }[]
): string {
  const tagsById = new Map(tags.map((t) => [t.id, t.name]));
  const tagsOf = new Map<string, string[]>();
  for (const et of elementTags) {
    const name = tagsById.get(et.tag_id);
    if (!name) continue;
    tagsOf.set(et.element_id, [...(tagsOf.get(et.element_id) ?? []), name]);
  }

  const roots = elements.filter(
    (e) => parentsOf(links, elements, e.id).length === 0
  );

  const lines: string[] = [];

  function walk(element: Element, depth: number, trail: Set<string>) {
    // Au-delà de six niveaux, Markdown n'a plus de titre à offrir : on
    // continue en gras pour ne rien perdre.
    const heading =
      depth < 6 ? `${'#'.repeat(depth + 1)} ${displayName(element)}`
      : `**${displayName(element)}**`;
    lines.push(heading);

    const ownTags = tagsOf.get(element.id);
    if (ownTags?.length) lines.push(`*Tags : ${ownTags.join(', ')}*`);

    const body = contentToMarkdown(element.content);
    if (body.trim()) lines.push(body);

    if (trail.has(element.id)) return;
    const deeper = new Set(trail).add(element.id);
    for (const child of childrenOf(links, elements, element.id)) {
      walk(child, depth + 1, deeper);
    }
  }

  for (const root of roots) walk(root, 0, new Set());

  return lines.join('\n\n') + '\n';
}

export function downloadMarkdown(markdown: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
