import { supabase } from './supabase';
import { getElementsByIds } from './elements';
import type { Collection, Element } from '../types';

export async function listCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data as Collection[];
}

export async function getCollection(id: string): Promise<Collection | null> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Collection | null;
}

export async function createCollection(name: string): Promise<Collection> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  const { data, error } = await supabase
    .from('collections')
    .insert({ name: name.trim(), user_id: user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
}

export async function listCollectionsForElement(
  elementId: string
): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collection_elements')
    .select('collections(*)')
    .eq('element_id', elementId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.collections as unknown as Collection)
    .filter(Boolean);
}

export async function listElementsInCollection(
  collectionId: string
): Promise<Element[]> {
  const { data, error } = await supabase
    .from('collection_elements')
    .select('element_id')
    .eq('collection_id', collectionId);
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.element_id as string);
  return getElementsByIds(ids);
}

// Pas de contrainte d'unicité sur collections.name en base : la
// déduplication par nom est une convention côté app, comme pour les tags,
// pour éviter de multiplier des collections identiques par erreur de frappe.
async function findOrCreateCollection(name: string): Promise<Collection> {
  const trimmed = name.trim();
  const { data: existing, error: findError } = await supabase
    .from('collections')
    .select('*')
    .ilike('name', trimmed)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing as Collection;
  return createCollection(trimmed);
}

export async function addElementToCollection(
  elementId: string,
  collectionName: string
): Promise<void> {
  const trimmed = collectionName.trim();
  if (!trimmed) return;
  const collection = await findOrCreateCollection(trimmed);
  const { error } = await supabase
    .from('collection_elements')
    .upsert(
      { collection_id: collection.id, element_id: elementId },
      { onConflict: 'collection_id,element_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function removeElementFromCollection(
  collectionId: string,
  elementId: string
): Promise<void> {
  const { error } = await supabase
    .from('collection_elements')
    .delete()
    .eq('collection_id', collectionId)
    .eq('element_id', elementId);
  if (error) throw error;
}
