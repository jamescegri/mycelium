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

export async function createElement(input: {
  name: string;
  family: ElementFamily;
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
      user_id: user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Element;
}

export async function updateElement(
  id: string,
  patch: Partial<Pick<Element, 'name' | 'family' | 'content' | 'notion_url' | 'absolute_date'>>
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

// Soft delete : on ne perd jamais rien silencieusement (corbeille, étape 15).
export async function softDeleteElement(id: string): Promise<void> {
  const { error } = await supabase
    .from('elements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
