import { supabase } from './supabase';
import type { Element, ElementFamily } from '../types';

// Toutes les requêtes excluent les Elements soft-deleted (deleted_at non nul)
// sauf listTrashed(), dédiée à la corbeille.
//
// v2 : la hiérarchie (parent/enfant, multi-parent) vit dans lib/links.ts,
// pas ici — un Element n'a plus de parent_id ni de sort_order propres.

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

export async function createElement(input: {
  name: string;
  family: ElementFamily;
  content?: object | string | null;
}): Promise<Element> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('elements')
    .insert({
      name: input.name,
      family: input.family,
      content: input.content ?? null,
      user_id: user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Element;
}

// Recherche utilisée par les déclencheurs de l'éditeur ("/", "@", "+") et
// par les pickers.
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
    Pick<Element, 'name' | 'family' | 'content' | 'notion_url' | 'absolute_date'>
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
