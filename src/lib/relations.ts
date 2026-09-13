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

// Elements qui mentionnent celui-ci dans leur texte. Volontairement limité
// à origin='mention' : les relations manuelles ont leur propre section
// (listManualRelations) pour éviter qu'une même relation apparaisse deux
// fois sur la page.
export async function listBacklinks(elementId: string): Promise<Relation[]> {
  const { data, error } = await supabase
    .from('relations')
    .select('*')
    .eq('origin', 'mention')
    .eq('target_id', elementId);
  if (error) throw error;
  return data as Relation[];
}

// Relations créées librement par l'utilisateur (pas issues d'une mention).
// Non dirigées côté UI : on affiche celles où l'Element est source OU cible.
export async function listManualRelations(
  elementId: string
): Promise<Relation[]> {
  const { data, error } = await supabase
    .from('relations')
    .select('*')
    .eq('origin', 'manual')
    .or(`source_id.eq.${elementId},target_id.eq.${elementId}`);
  if (error) throw error;
  return data as Relation[];
}

export async function createManualRelation(
  sourceId: string,
  targetId: string,
  label?: string
): Promise<Relation> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('relations')
    .insert({
      source_id: sourceId,
      target_id: targetId,
      origin: 'manual',
      label: label?.trim() || null,
      user_id: user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Relation;
}

export async function deleteRelation(id: string): Promise<void> {
  const { error } = await supabase.from('relations').delete().eq('id', id);
  if (error) throw error;
}
