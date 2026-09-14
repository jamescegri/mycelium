-- Mycelium — schéma de base de données (v3)
-- À coller dans l'éditeur SQL de ton projet Supabase (SQL Editor > New query).
--
-- CE SCRIPT EST REJOUABLE : tu peux le coller autant de fois que tu veux,
-- sur une base vide comme sur une base déjà en v1/v2. Il crée ce qui manque,
-- met à jour ce qui a changé, et ne touche jamais à tes données.
--
-- v3 : il n'existe plus aucun type d'Element. La colonne `family` a disparu.
-- "Être un Groupe"          = avoir au moins un enfant dans element_links.
-- "Être dans la chronologie" = avoir timeline = true.
-- Deux dimensions optionnelles d'un même objet générique, jamais des
-- catégories : un Element peut être les deux, l'une, ou aucune.

create extension if not exists "pgcrypto";

-- Types énumérés : create type n'accepte pas "if not exists".
do $$ begin
  create type temporal_relation_type as enum ('BEFORE', 'AFTER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relation_origin as enum ('manual', 'mention');
exception when duplicate_object then null; end $$;

create table if not exists elements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  -- Dimension optionnelle : l'Element participe-t-il à la chronologie ?
  -- Sa POSITION dans cette chronologie vit dans temporal_relations, pas
  -- ici — ce drapeau dit seulement qu'il en fait partie, ce qu'aucune
  -- relation ne peut exprimer pour le tout premier Element placé.
  timeline boolean not null default false,
  content jsonb,
  notion_url text,
  absolute_date text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hiérarchie multi-parent : un Element peut être enfant de plusieurs
-- Groupes à la fois, et un Groupe n'est rien d'autre qu'un Element qui a
-- au moins une ligne ici en tant que parent_id. sort_order ordonne les
-- enfants d'UN parent donné (pas de sort_order global sur l'Element).
create table if not exists element_links (
  parent_id uuid not null references elements(id) on delete cascade,
  child_id uuid not null references elements(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  unique (user_id, name)
);
-- Index insensible à la casse pour éviter les doublons "#Mystere" / "#mystere"
create unique index if not exists tags_user_name_lower_idx
  on tags (user_id, lower(name));

create table if not exists element_tags (
  element_id uuid references elements(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (element_id, tag_id)
);

create table if not exists relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  source_id uuid not null references elements(id) on delete cascade,
  target_id uuid not null references elements(id) on delete cascade,
  label text,
  origin relation_origin not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists temporal_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  element_a uuid not null references elements(id) on delete cascade,
  type temporal_relation_type not null,
  element_b uuid not null references elements(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- Mises à niveau depuis les versions précédentes.
-- Sans effet si la base est déjà en v3 ou vient d'être créée.
-- ─────────────────────────────────────────────────────────────────────

-- v3 : la Timeline devient une option de n'importe quel Element.
alter table elements add column if not exists timeline boolean not null default false;

-- Les anciens Elements de famille TIME entrent dans la chronologie, pour
-- ne pas les perdre au passage. Fait avant de supprimer la colonne.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'elements' and column_name = 'family'
  ) then
    execute 'update elements set timeline = true where family::text = ''TIME''';
  end if;
end $$;

alter table elements drop column if exists family;
drop index if exists elements_family_idx;
drop type if exists element_family;

-- v2 : la hiérarchie a quitté elements (parent_id unique) pour
-- element_links (multi-parent). Les anciens liens sont repris.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'elements' and column_name = 'parent_id'
  ) then
    execute '
      insert into element_links (parent_id, child_id, sort_order)
      select parent_id, id, coalesce(sort_order, 0) from elements
      where parent_id is not null
      on conflict do nothing';
  end if;
end $$;

alter table elements drop column if exists parent_id;
alter table elements drop column if exists sort_order;
drop table if exists collection_elements;
drop table if exists collections;

-- ─────────────────────────────────────────────────────────────────────

create index if not exists elements_timeline_idx on elements (timeline) where timeline;
create index if not exists elements_user_idx on elements (user_id);
create index if not exists element_links_parent_idx on element_links (parent_id);
create index if not exists element_links_child_idx on element_links (child_id);
create index if not exists relations_source_idx on relations (source_id);
create index if not exists relations_target_idx on relations (target_id);
create index if not exists temporal_relations_a_idx on temporal_relations (element_a);
create index if not exists temporal_relations_b_idx on temporal_relations (element_b);

-- Trigger updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists elements_set_updated_at on elements;
create trigger elements_set_updated_at
before update on elements
for each row execute function set_updated_at();

-- Row Level Security : chacun ne voit / modifie que ses propres données
alter table elements enable row level security;
alter table element_links enable row level security;
alter table tags enable row level security;
alter table element_tags enable row level security;
alter table relations enable row level security;
alter table temporal_relations enable row level security;

drop policy if exists "own elements" on elements;
create policy "own elements" on elements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own tags" on tags;
create policy "own tags" on tags for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own relations" on relations;
create policy "own relations" on relations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own temporal_relations" on temporal_relations;
create policy "own temporal_relations" on temporal_relations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tables de jointure : accès basé sur la propriété de l'élément/tag parent
drop policy if exists "own element_tags" on element_tags;
create policy "own element_tags" on element_tags for all
  using (exists (select 1 from elements e where e.id = element_id and e.user_id = auth.uid()))
  with check (exists (select 1 from elements e where e.id = element_id and e.user_id = auth.uid()));

drop policy if exists "own element_links" on element_links;
create policy "own element_links" on element_links for all
  using (exists (select 1 from elements e where e.id = parent_id and e.user_id = auth.uid()))
  with check (exists (select 1 from elements e where e.id = parent_id and e.user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────
-- Images
--
-- Elles vivent dans le stockage, pas dans le contenu des Elements :
-- encoder un character design de 4 Mo dans la colonne jsonb ferait
-- rapatrier l'image entière à chaque chargement, même pour afficher une
-- liste de titres.
--
-- Le bucket est public en lecture — une URL d'image doit pouvoir être
-- affichée par la balise <img> sans jeton — mais on n'écrit que dans son
-- propre dossier, dont le nom est l'identifiant de l'auteur.
-- ─────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

drop policy if exists "images readable" on storage.objects;
create policy "images readable" on storage.objects for select
  using (bucket_id = 'images');

drop policy if exists "own images insert" on storage.objects;
create policy "own images insert" on storage.objects for insert
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own images delete" on storage.objects;
create policy "own images delete" on storage.objects for delete
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
