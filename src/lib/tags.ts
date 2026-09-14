import { supabase } from './supabase';
import type { Tag } from '../types';

export async function listTagsForElement(elementId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('element_tags')
    .select('tags(*)')
    .eq('element_id', elementId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.tags as unknown as Tag)
    .filter(Boolean);
}

// Les noms de tags sont insensibles à la casse (index unique sur
// lower(name)) : "#Mystere" et "#mystere" réutilisent le même tag.
async function findOrCreateTag(name: string, userId: string): Promise<Tag> {
  const trimmed = name.trim();
  const { data: existing, error: findError } = await supabase
    .from('tags')
    .select('*')
    .ilike('name', trimmed)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing as Tag;

  const { data: created, error: insertError } = await supabase
    .from('tags')
    .insert({ name: trimmed, user_id: userId })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return created as Tag;
}

export async function addTagToElement(
  elementId: string,
  tagName: string
): Promise<void> {
  const trimmed = tagName.trim();
  if (!trimmed) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const tag = await findOrCreateTag(trimmed, user.id);
  const { error } = await supabase
    .from('element_tags')
    .upsert(
      { element_id: elementId, tag_id: tag.id },
      { onConflict: 'element_id,tag_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function removeTagFromElement(
  elementId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('element_tags')
    .delete()
    .eq('element_id', elementId)
    .eq('tag_id', tagId);
  if (error) throw error;
}

// Pour la vue Connexions : tous les tags, et la table de jointure entière.
// Un Tag n'a ni page, ni contenu, ni enfants — c'est une étiquette de
// filtrage transversal, rien de plus. On charge donc la jointure d'un bloc
// et on filtre côté client, comme pour les liens et les relations.
export async function listAllTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*').order('name');
  if (error) throw error;
  return data as Tag[];
}

export async function listAllElementTags(): Promise<
  { element_id: string; tag_id: string }[]
> {
  const { data, error } = await supabase
    .from('element_tags')
    .select('element_id, tag_id');
  if (error) throw error;
  return data as { element_id: string; tag_id: string }[];
}
