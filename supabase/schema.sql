-- Mycelium — schéma de base de données (v2)
-- À coller dans l'éditeur SQL de ton projet Supabase (SQL Editor > New query)
--
-- v2 : la hiérarchie n'est plus un arbre à parent unique (elements.parent_id)
-- mais un graphe multi-parent (table element_links). Un Element qui a au
-- moins un enfant EST un Groupe/une Collection — il n'y a plus de table
-- collections séparée. Family ne garde que TIME (pour la future timeline)
-- et ELEMENTS (tout le reste, y compris ce qui était "Lieu" avant).

create extension if not exists "pgcrypto";

create type element_family as enum ('TIME', 'ELEMENTS');
create type temporal_relation_type as enum ('BEFORE', 'AFTER');
create type relation_origin as enum ('manual', 'mention');

create table elements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  family element_family not null,
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
create table element_links (
  parent_id uuid not null references elements(id) on delete cascade,
  child_id uuid not null references elements(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  unique (user_id, name)
);
-- Index insensible à la casse pour éviter les doublons "#Mystere" / "#mystere"
create unique index tags_user_name_lower_idx on tags (user_id, lower(name));

create table element_tags (
  element_id uuid references elements(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (element_id, tag_id)
);

create table relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  source_id uuid not null references elements(id) on delete cascade,
  target_id uuid not null references elements(id) on delete cascade,
  label text,
  origin relation_origin not null default 'manual',
  created_at timestamptz not null default now()
);

create table temporal_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  element_a uuid not null references elements(id) on delete cascade,
  type temporal_relation_type not null,
  element_b uuid not null references elements(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Index utiles
create index elements_family_idx on elements (family);
create index elements_user_idx on elements (user_id);
create index element_links_parent_idx on element_links (parent_id);
create index element_links_child_idx on element_links (child_id);
create index relations_source_idx on relations (source_id);
create index relations_target_idx on relations (target_id);
create index temporal_relations_a_idx on temporal_relations (element_a);
create index temporal_relations_b_idx on temporal_relations (element_b);

-- Trigger updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

create policy "own elements" on elements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tags" on tags for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own relations" on relations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own temporal_relations" on temporal_relations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tables de jointure : accès basé sur la propriété de l'élément/tag parent
create policy "own element_tags" on element_tags for all
  using (exists (select 1 from elements e where e.id = element_id and e.user_id = auth.uid()))
  with check (exists (select 1 from elements e where e.id = element_id and e.user_id = auth.uid()));
create policy "own element_links" on element_links for all
  using (exists (select 1 from elements e where e.id = parent_id and e.user_id = auth.uid()))
  with check (exists (select 1 from elements e where e.id = parent_id and e.user_id = auth.uid()));
