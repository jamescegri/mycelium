// Reflète exactement le schéma SQL (supabase/schema.sql).
// Un seul type d'objet narratif : Element. Ne JAMAIS ajouter de types
// comme Character/Chapter/Scene/Arc ici — voir le cahier des charges.
//
// v3 : aucun type d'Element. Un Element devient un Groupe parce qu'il a des
// enfants, et entre dans la chronologie parce qu'on l'y a placé. Ce sont
// deux dimensions optionnelles du même objet, pas des catégories.

export type TemporalRelationType = 'BEFORE' | 'AFTER';
export type RelationOrigin = 'manual' | 'mention';

export interface Element {
  id: string;
  user_id: string;
  name: string;
  timeline: boolean;
  content: unknown | null; // JSON Tiptap
  notion_url: string | null;
  absolute_date: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ElementLink {
  parent_id: string;
  child_id: string;
  sort_order: number;
  created_at: string;
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
