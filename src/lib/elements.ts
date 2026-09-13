import { supabase } from './supabase';
import type { Element, ElementFamily } from '../types';

// Toutes les requêtes excluent les Elements soft-deleted (deleted_at non nul)
// sauf getTrashed(), dédiée à la corbeille (étape 15).

export async function listElements(): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Element[];
}

export async function getElement(id: string): Promise<Element | null> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as Element | null;
}

// Le sort_order du nouvel Element est calculé ici, au même endroit pour
// tous les appelants (liste racine, "+ enfant" depuis une page, création à
// la volée dans un picker ou depuis "/") : il vient toujours se placer en
// dernière position parmi ses frères et sœurs (même parent, ou racine si
// parentId est absent), jamais en tête ni en collision avec un existant.
export async function createElement(input: {
  name: string;
  family: ElementFamily;
  parentId?: string | null;
}): Promise<Element> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const parentId = input.parentId ?? null;
  let siblingQuery = supabase
    .from('elements')
    .select('sort_order')
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1);
  siblingQuery = parentId
    ? siblingQuery.eq('parent_id', parentId)
    : siblingQuery.is('parent_id', null);
  const { data: topSibling, error: siblingError } = await siblingQuery;
  if (siblingError) throw siblingError;
  const nextSortOrder = (topSibling?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('elements')
    .insert({
      name: input.name,
      family: input.family,
      parent_id: parentId,
      sort_order: nextSortOrder,
      user_id: user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Element;
}

// Recherche utilisée par le système de mention "/" et par les pickers
// (relations libres, choix du parent).
export async function searchElements(
  query: string,
  excludeIds?: string[]
): Promise<Element[]> {
  let request = supabase
    .from('elements')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(8);
  if (query.trim()) {
    request = request.ilike('name', `%${query.trim()}%`);
  }
  if (excludeIds && excludeIds.length > 0) {
    request = request.not('id', 'in', `(${excludeIds.join(',')})`);
  }
  const { data, error } = await request;
  if (error) throw error;
  return data as Element[];
}

// Garde anti-cycle : calcule, à partir d'une liste d'Elements déjà chargée
// (ex. listElements), tous les descendants de rootId. Utilisé pour exclure
// un Element et ses propres descendants du choix de son nouveau parent —
// sinon on pourrait créer une boucle parent → enfant → parent.
export function getDescendantIds(
  elements: Element[],
  rootId: string
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const el of elements) {
    if (!el.parent_id) continue;
    const list = childrenByParent.get(el.parent_id) ?? [];
    list.push(el.id);
    childrenByParent.set(el.parent_id, list);
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

// Ordre stable d'affichage entre frères et sœurs. sort_order est la source
// de vérité ; created_at ne sert qu'à départager les Elements créés avant
// l'introduction de cet ordre explicite (tous à 0 par défaut), pour éviter
// un ordre qui semble aléatoire tant qu'on ne les a pas encore réorganisés.
export function sortByOrder(elements: Element[]): Element[] {
  return [...elements].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

// Fil d'Ariane : chaîne des ancêtres d'un Element, racine en premier.
// S'arrête silencieusement sur une référence cassée ou un cycle de données
// plutôt que de boucler à l'infini.
export function getAncestors(elements: Element[], id: string): Element[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const chain: Element[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current?.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

// Déplace un Element d'un cran parmi une fratrie déjà triée (sortByOrder)
// et renumérote toute la fratrie en 0..n-1. Renuméroter systématiquement
// (plutôt que d'insérer une valeur intermédiaire) répare au passage les
// sort_order à 0 hérités des Elements créés avant l'introduction de cet
// ordre.
export async function reorderSibling(
  orderedSiblings: Element[],
  elementId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const index = orderedSiblings.findIndex((e) => e.id === elementId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= orderedSiblings.length) {
    return;
  }
  const reordered = [...orderedSiblings];
  [reordered[index], reordered[swapWith]] = [
    reordered[swapWith],
    reordered[index],
  ];
  await Promise.all(
    reordered.map((el, i) =>
      el.sort_order === i ? null : updateElement(el.id, { sort_order: i })
    )
  );
}

export async function getElementsByIds(ids: string[]): Promise<Element[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .in('id', ids)
    .is('deleted_at', null);
  if (error) throw error;
  return data as Element[];
}

export async function updateElement(
  id: string,
  patch: Partial<
    Pick<
      Element,
      | 'name'
      | 'family'
      | 'content'
      | 'notion_url'
      | 'absolute_date'
      | 'parent_id'
      | 'sort_order'
    >
  >
): Promise<Element> {
  const { data, error } = await supabase
    .from('elements')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Element;
}

// Soft delete : on ne perd jamais rien silencieusement (corbeille).
export async function softDeleteElement(id: string): Promise<void> {
  const { error } = await supabase
    .from('elements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function listTrashed(): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return data as Element[];
}

export async function restoreElement(id: string): Promise<void> {
  const { error } = await supabase
    .from('elements')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
}
