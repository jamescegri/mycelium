import { supabase } from './supabase';
import type { Relation } from '../types';

// Une mention "/" dans le contenu d'un Element crée une relation
// origin='mention'. Cette fonction resynchronise ces relations avec la
// liste actuelle des mentions présentes dans le texte : elle ajoute les
// nouvelles, retire celles qui ont disparu, et ne touche jamais aux
// relations manuelles (origin='manual').
export async function syncMentionRelations(
  sourceId: string,
  mentionedIds: string[]
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('relations')
    .select('id, target_id')
    .eq('source_id', sourceId)
    .eq('origin', 'mention');
  if (fetchError) throw fetchError;

  const uniqueMentioned = [...new Set(mentionedIds)];
  const existingTargetIds = new Set((existing ?? []).map((r) => r.target_id));

  const toInsert = uniqueMentioned.filter((id) => !existingTargetIds.has(id));
  const toDelete = (existing ?? []).filter(
    (r) => !uniqueMentioned.includes(r.target_id)
  );

  if (toInsert.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Non authentifié');
    const { error } = await supabase.from('relations').insert(
      toInsert.map((targetId) => ({
        source_id: sourceId,
        target_id: targetId,
        origin: 'mention' as const,
        user_id: user.id,
      }))
    );
    if (error) throw error;
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('relations')
      .delete()
      .in('id', toDelete.map((r) => r.id));
    if (error) throw error;
  }
}

export async function listRelationsForElement(
  elementId: string
): Promise<Relation[]> {
  const { data, error } = await supabase
    .from('relations')
    .select('*')
    .or(`source_id.eq.${elementId},target_id.eq.${elementId}`);
  if (error) throw error;
  return data as Relation[];
}

// Elements qui référencent celui-ci (mentions "/" pour l'instant, relations
// manuelles à l'étape 5).
export async function listBacklinks(elementId: string): Promise<Relation[]> {
  const { data, error } = await supabase
    .from('relations')
    .select('*')
    .eq('target_id', elementId);
  if (error) throw error;
  return data as Relation[];
}
