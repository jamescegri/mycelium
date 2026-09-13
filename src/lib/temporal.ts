import { supabase } from './supabase';
import type { TemporalRelation, TemporalRelationType } from '../types';

export async function listTemporalRelations(): Promise<TemporalRelation[]> {
  const { data, error } = await supabase.from('temporal_relations').select('*');
  if (error) throw error;
  return data as TemporalRelation[];
}

export async function listTemporalRelationsForElement(
  elementId: string
): Promise<TemporalRelation[]> {
  const { data, error } = await supabase
    .from('temporal_relations')
    .select('*')
    .or(`element_a.eq.${elementId},element_b.eq.${elementId}`);
  if (error) throw error;
  return data as TemporalRelation[];
}

export async function createTemporalRelation(
  elementA: string,
  type: TemporalRelationType,
  elementB: string
): Promise<TemporalRelation> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('temporal_relations')
    .insert({ element_a: elementA, type, element_b: elementB, user_id: user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data as TemporalRelation;
}

export async function deleteTemporalRelation(id: string): Promise<void> {
  const { error } = await supabase.from('temporal_relations').delete().eq('id', id);
  if (error) throw error;
}
