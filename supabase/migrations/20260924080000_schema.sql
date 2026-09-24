-- Calbasse : schéma initial.
-- Règle générale : RLS activée partout, un utilisateur ne voit et ne modifie que ses lignes.
-- Les écritures sensibles (plan, quota, table des plats) passent par le service role uniquement.

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Jour de référence du journal et du quota (heure du Bénin).
create or replace function public.app_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Porto-Novo')::date;
$$;

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text check (char_length(prenom) between 1 and 60),
  sexe text check (sexe in ('femme', 'homme')),
  age smallint check (age between 13 and 110),
  taille_cm numeric(5, 1) check (taille_cm between 100 and 250),
  poids_kg numeric(5, 1) check (poids_kg between 25 and 350),
  niveau_activite numeric(4, 3) check (niveau_activite between 1.2 and 1.9),
  objectif text check (objectif in ('perte', 'maintien', 'prise')),
  calories_cible integer check (calories_cible between 1000 and 6000),
  plan text not null default 'free' check (plan in ('free', 'premium')),
  -- Consentement à joindre la photo aux corrections (désactivé par défaut).
  partage_photos boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.plan is 'Modifiable uniquement par le service role (voir les droits par colonne).';

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Chaque nouvel utilisateur (invité compris) reçoit un profil vide.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profil : lecture de soi"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "profil : mise à jour de soi"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Pas d'insert ni de delete côté client : le profil naît avec le compte et meurt avec lui.
-- Droits par colonne : l'utilisateur ne peut pas toucher à plan, id ni aux dates.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (prenom, sexe, age, taille_cm, poids_kg, niveau_activite, objectif, calories_cible, partage_photos)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Table des plats et ingrédients locaux
-- ---------------------------------------------------------------------------

create table public.foods (
  id bigint generated always as identity primary key,
  food_key text not null unique check (food_key ~ '^[a-z0-9_]+$'),
  label_fr text not null,
  -- Autres noms courants (fon, yoruba, wolof, noms de marché) pour aider l'identification.
  aliases text[] not null default '{}',
  categorie text not null check (
    categorie in ('feculent', 'plat_complet', 'sauce', 'proteine', 'legume', 'fruit', 'matiere_grasse', 'snack', 'boisson', 'sucre')
  ),
  kcal_100g numeric(6, 1) not null check (kcal_100g >= 0),
  proteines_100g numeric(5, 1) not null check (proteines_100g >= 0),
  glucides_100g numeric(5, 1) not null check (glucides_100g >= 0),
  lipides_100g numeric(5, 1) not null check (lipides_100g >= 0),
  -- Repères de portion en grammes, ex. {"louche": 120, "bol": 250}.
  portion_reperes jsonb not null default '{}' check (jsonb_typeof(portion_reperes) = 'object'),
  source text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger foods_updated_at
before update on public.foods
for each row execute function public.set_updated_at();

alter table public.foods enable row level security;

create policy "plats : lecture publique"
on public.foods for select
to anon, authenticated
using (true);

revoke insert, update, delete, truncate on public.foods from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Repas et éléments de repas
-- ---------------------------------------------------------------------------

create table public.meals (
  -- L'identifiant est généré par l'app pour que la synchro hors ligne soit idempotente.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  type_repas text not null check (type_repas in ('petit_dejeuner', 'dejeuner', 'diner', 'en_cas')),
  photo_path text,
  total_kcal numeric(7, 1) not null default 0 check (total_kcal >= 0),
  total_proteines numeric(6, 1) not null default 0 check (total_proteines >= 0),
  total_glucides numeric(6, 1) not null default 0 check (total_glucides >= 0),
  total_lipides numeric(6, 1) not null default 0 check (total_lipides >= 0),
  confidence_globale numeric(3, 2) check (confidence_globale between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meals_user_eaten_at on public.meals (user_id, eaten_at desc);

create trigger meals_updated_at
before update on public.meals
for each row execute function public.set_updated_at();

alter table public.meals enable row level security;

create policy "repas : lecture de soi"
on public.meals for select to authenticated
using (user_id = (select auth.uid()));

create policy "repas : création pour soi"
on public.meals for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "repas : mise à jour de soi"
on public.meals for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "repas : suppression de soi"
on public.meals for delete to authenticated
using (user_id = (select auth.uid()));

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  position smallint not null default 0,
  food_key text references public.foods (food_key) on update cascade on delete set null,
  label text not null check (char_length(label) between 1 and 120),
  grams numeric(6, 1) not null check (grams > 0 and grams <= 5000),
  kcal numeric(7, 1) not null check (kcal >= 0),
  proteines numeric(6, 1) not null check (proteines >= 0),
  glucides numeric(6, 1) not null check (glucides >= 0),
  lipides numeric(6, 1) not null check (lipides >= 0),
  -- true quand l'élément n'est pas dans la table foods : valeurs estimées par l'IA.
  estimated boolean not null default false
);

create index meal_items_meal on public.meal_items (meal_id);

alter table public.meal_items enable row level security;

create policy "éléments : accès via ses repas"
on public.meal_items for all to authenticated
using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())))
with check (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Corrections (prédiction de l'IA vs saisie finale de l'utilisateur)
-- ---------------------------------------------------------------------------

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_id uuid references public.meals (id) on delete cascade,
  predicted jsonb not null,
  corrected jsonb not null,
  -- Rempli seulement si profiles.partage_photos est vrai.
  photo_path text,
  created_at timestamptz not null default now()
);

create index corrections_user on public.corrections (user_id);

alter table public.corrections enable row level security;

create policy "corrections : lecture de soi"
on public.corrections for select to authenticated
using (user_id = (select auth.uid()));

create policy "corrections : création pour soi"
on public.corrections for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "corrections : suppression de soi"
on public.corrections for delete to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Quota de scans IA
-- ---------------------------------------------------------------------------

create table public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.scan_usage enable row level security;

create policy "quota : lecture de soi"
on public.scan_usage for select to authenticated
using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.scan_usage from anon, authenticated;

-- Scans autorisés par jour. Invité : 1, gratuit : 3, premium : plafond anti-abus.
create or replace function public.scan_quota(p_plan text, p_is_anonymous boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_anonymous then 1
    when p_plan = 'premium' then 30
    else 3
  end;
$$;

-- Consomme un scan si le quota le permet. Atomique : deux appels simultanés
-- ne peuvent pas dépasser le quota. Réservé au service role (Edge Function).
create or replace function public.consume_scan(p_user_id uuid)
returns table (allowed boolean, used integer, quota integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_anonymous boolean;
  v_quota integer;
  v_used integer;
  v_day date := public.app_today();
begin
  select p.plan into v_plan from public.profiles p where p.id = p_user_id;
  select coalesce(u.is_anonymous, false) into v_anonymous from auth.users u where u.id = p_user_id;
  if v_anonymous is null then
    raise exception 'utilisateur inconnu: %', p_user_id using errcode = 'P0002';
  end if;

  v_quota := public.scan_quota(coalesce(v_plan, 'free'), v_anonymous);

  insert into public.scan_usage as s (user_id, day, count)
  values (p_user_id, v_day, 1)
  on conflict (user_id, day) do update
    set count = s.count + 1
    where s.count < v_quota
  returning s.count into v_used;

  if v_used is null then
    select s.count into v_used from public.scan_usage s where s.user_id = p_user_id and s.day = v_day;
    return query select false, v_used, v_quota;
  else
    return query select true, v_used, v_quota;
  end if;
end;
$$;

-- Rend un scan si l'analyse a échoué côté serveur (l'utilisateur n'est pas pénalisé).
create or replace function public.release_scan(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.scan_usage
  set count = count - 1
  where user_id = p_user_id and day = public.app_today() and count > 0;
$$;

-- Scans restants aujourd'hui pour l'utilisateur connecté (affichage dans l'app).
create or replace function public.get_scan_status()
returns table (used integer, quota integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select
      coalesce((select s.count from public.scan_usage s where s.user_id = auth.uid() and s.day = public.app_today()), 0) as used,
      public.scan_quota(
        coalesce((select p.plan from public.profiles p where p.id = auth.uid()), 'free'),
        coalesce((select u.is_anonymous from auth.users u where u.id = auth.uid()), false)
      ) as quota
  )
  select used, quota, greatest(quota - used, 0) from me
  where auth.uid() is not null;
$$;

revoke execute on function public.consume_scan(uuid) from public, anon, authenticated;
revoke execute on function public.release_scan(uuid) from public, anon, authenticated;
revoke execute on function public.get_scan_status() from public, anon;
grant execute on function public.consume_scan(uuid) to service_role;
grant execute on function public.release_scan(uuid) to service_role;
grant execute on function public.get_scan_status() to authenticated;
