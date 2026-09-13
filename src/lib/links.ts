import { supabase } from './supabase';
import type { Element, ElementLink } from '../types';

// La hiérarchie n'est plus un arbre : un Element peut avoir plusieurs
// parents et plusieurs enfants (table element_links, many-to-many). Un
// Groupe/une Collection n'est rien d'autre qu'un Element qui a au moins un
// enfant — pas de table séparée. Comme pour listElements(), on récupère
// tous les liens une fois (mis en cache), puis on dérive tout côté client
// plutôt que de multiplier les requêtes.
export async function listAllLinks(): Promise<ElementLink[]> {
  const { data, error } = await supabase.from('element_links').select('*');
  if (error) throw error;
  return data as ElementLink[];
}

export function childrenOf(
  links: ElementLink[],
  elements: Element[],
  parentId: string
): Element[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  return links
    .filter((l) => l.parent_id === parentId)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
    )
    .map((l) => byId.get(l.child_id))
    .filter((e): e is Element => !!e);
}

export function parentsOf(
  links: ElementLink[],
  elements: Element[],
  childId: string
): Element[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  return links
    .filter((l) => l.child_id === childId)
    .map((l) => byId.get(l.parent_id))
    .filter((e): e is Element => !!e);
}

// Tous les descendants d'un Element (BFS sur les enfants), tous chemins
// confondus — un descendant atteignable par plusieurs chemins n'apparaît
// qu'une fois. Sert à exclure les descendants du choix d'un nouveau parent
// (sinon on pourrait créer une boucle).
export function getDescendantIds(
  links: ElementLink[],
  rootId: string
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const l of links) {
    const list = childrenByParent.get(l.parent_id) ?? [];
    list.push(l.child_id);
    childrenByParent.set(l.parent_id, list);
  }
  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (descendants.has(id)) continue;
    descendants.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return descendants;
}

// Tous les ancêtres d'un Element (BFS sur les parents), tous chemins
// confondus. Sert à exclure les ancêtres du choix d'un nouvel enfant
// (sinon on pourrait créer une boucle dans l'autre sens).
export function getAncestorIds(
  links: ElementLink[],
  rootId: string
): Set<string> {
  const parentsByChild = new Map<string, string[]>();
  for (const l of links) {
    const list = parentsByChild.get(l.child_id) ?? [];
    list.push(l.parent_id);
    parentsByChild.set(l.child_id, list);
  }
  const ancestors = new Set<string>();
  const queue = [...(parentsByChild.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    queue.push(...(parentsByChild.get(id) ?? []));
  }
  return ancestors;
}

// Ajouter le lien (parentId -> childId) créerait une boucle si parentId
// est déjà un descendant de childId (ou si on essaie de se lier à soi-même).
export function wouldCreateCycle(
  links: ElementLink[],
  parentId: string,
  childId: string
): boolean {
  if (parentId === childId) return true;
  return getDescendantIds(links, childId).has(parentId);
}

export function hasChildren(links: ElementLink[], elementId: string): boolean {
  return links.some((l) => l.parent_id === elementId);
}

// Ids de tous les Elements qui sont un Groupe (ont au moins un enfant).
export function groupIds(links: ElementLink[]): Set<string> {
  return new Set(links.map((l) => l.parent_id));
}

// Racines : Elements qui n'apparaissent comme enfant nulle part.
export function rootElements(
  links: ElementLink[],
  elements: Element[]
): Element[] {
  const childIds = new Set(links.map((l) => l.child_id));
  return elements.filter((e) => !childIds.has(e.id));
}

export async function linkChild(
  parentId: string,
  childId: string
): Promise<void> {
  if (parentId === childId) {
    throw new Error('Un Element ne peut pas être son propre parent.');
  }
  const { data: topSibling, error: fetchError } = await supabase
    .from('element_links')
    .select('sort_order')
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (fetchError) throw fetchError;
  const nextSortOrder = (topSibling?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase.from('element_links').upsert(
    { parent_id: parentId, child_id: childId, sort_order: nextSortOrder },
    { onConflict: 'parent_id,child_id', ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function unlinkChild(
  parentId: string,
  childId: string
): Promise<void> {
  const { error } = await supabase
    .from('element_links')
    .delete()
    .eq('parent_id', parentId)
    .eq('child_id', childId);
  if (error) throw error;
}

// Réordonne les enfants d'UN parent donné (le sort_order n'a de sens que
// dans le contexte d'un parent précis, plus au niveau de l'Element lui-même).
export async function reorderChild(
  orderedChildren: Element[],
  parentId: string,
  childId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const index = orderedChildren.findIndex((e) => e.id === childId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= orderedChildren.length) {
    return;
  }
  const reordered = [...orderedChildren];
  [reordered[index], reordered[swapWith]] = [
    reordered[swapWith],
    reordered[index],
  ];
  await Promise.all(
    reordered.map(async (el, i) => {
      const { error } = await supabase
        .from('element_links')
        .update({ sort_order: i })
        .eq('parent_id', parentId)
        .eq('child_id', el.id);
      if (error) throw error;
    })
  );
}
