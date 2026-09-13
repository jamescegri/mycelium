// Reflète exactement le schéma SQL (supabase/schema.sql).
// Un seul type d'objet narratif : Element. Ne JAMAIS ajouter de types
// comme Character/Chapter/Scene/Arc ici — voir le cahier des charges.

export type ElementFamily = 'TIME' | 'SPACE' | 'ELEMENTS';
export type TemporalRelationType = 'BEFORE' | 'AFTER';
export type RelationOrigin = 'manual' | 'mention';

export interface Element {
  id: string;
  user_id: string;
  name: string;
  family: ElementFamily;
  content: unknown | null; // JSON Tiptap
  parent_id: string | null;
  notion_url: string | null;
  absolute_date: string | null;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
}

export interface Relation {
  id: string;
  user_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  origin: RelationOrigin;
  created_at: string;
}

export interface TemporalRelation {
  id: string;
  user_id: string;
  element_a: string;
  type: TemporalRelationType;
  element_b: string;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
}

export const FAMILIES: ElementFamily[] = ['TIME', 'SPACE', 'ELEMENTS'];
