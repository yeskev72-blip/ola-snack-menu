-- Calbasse : installation complète de la base (tables, RLS, quota, suivi des scans, 69 plats).
-- GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/migrations et supabase/seed.sql.
-- À coller tel quel dans Supabase > SQL Editor, puis « Run ». À n'exécuter qu'UNE fois sur un projet neuf.
-- Si tu utilises plus tard la CLI Supabase, marque d'abord ces migrations comme appliquées :
--   npx supabase@latest migration repair --status applied 20260924080000
--   npx supabase@latest migration repair --status applied 20260924080100
--   npx supabase@latest migration repair --status applied 20260924090000
--   npx supabase@latest migration repair --status applied 20260925100000

begin;

-- ============================================================================
-- 20260924080000_schema.sql
-- ============================================================================
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

-- ============================================================================
-- 20260924080100_storage.sql
-- ============================================================================
-- Stockage facultatif des photos de repas (désactivé par défaut côté Edge Function).
-- Bucket privé ; chaque utilisateur n'accède qu'à son dossier « <user_id>/... ».

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "photos : lecture de son dossier"
on storage.objects for select to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "photos : suppression de son dossier"
on storage.objects for delete to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Pas de politique d'insertion : l'upload est fait par l'Edge Function (service role).

-- ============================================================================
-- 20260924090000_scans.sql
-- ============================================================================
-- Suivi des scans IA : un scan = un appel facturé au quota, avec au plus une relance
-- gratuite si l'utilisateur répond aux questions de clarification.
-- Chaque appel Gemini est journalisé avec ses tokens pour suivre le coût réel.

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Passe à true quand la relance (réponses aux questions) a été utilisée.
  follow_up_used boolean not null default false,
  -- Empreinte de la photo : la relance gratuite doit porter sur la même image.
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  photo_path text
);

create index scans_user_created on public.scans (user_id, created_at desc);

create table public.scan_calls (
  id bigint generated always as identity primary key,
  scan_id uuid not null references public.scans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('initial', 'follow_up')),
  attempt smallint not null default 1,
  model text not null,
  ok boolean not null,
  error text,
  prompt_tokens integer,
  output_tokens integer,
  thoughts_tokens integer,
  total_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index scan_calls_user_created on public.scan_calls (user_id, created_at desc);

-- Accès réservé au service role (Edge Function) : RLS sans politique pour les clients.
alter table public.scans enable row level security;
alter table public.scan_calls enable row level security;
revoke all on public.scans, public.scan_calls from anon, authenticated;

-- Réserve la relance d'un scan de façon atomique : une seule par scan, scan récent,
-- même utilisateur et même photo.
create or replace function public.claim_follow_up(p_scan_id uuid, p_user_id uuid, p_image_sha256 text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.scans
    set follow_up_used = true
    where id = p_scan_id
      and user_id = p_user_id
      and image_sha256 = p_image_sha256
      and not follow_up_used
      and created_at > now() - interval '30 minutes'
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- Rend la relance si l'analyse a échoué.
create or replace function public.release_follow_up(p_scan_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.scans set follow_up_used = false where id = p_scan_id;
$$;

revoke execute on function public.claim_follow_up(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.release_follow_up(uuid) from public, anon, authenticated;
grant execute on function public.claim_follow_up(uuid, uuid, text) to service_role;
grant execute on function public.release_follow_up(uuid) to service_role;

-- Coût par utilisateur et par jour (heure du Bénin), pour le suivi dans le SQL Editor.
create view public.scan_costs_daily
with (security_invoker = true)
as
select
  user_id,
  (created_at at time zone 'Africa/Porto-Novo')::date as day,
  count(*) as calls,
  count(*) filter (where not ok) as failed_calls,
  sum(prompt_tokens) as prompt_tokens,
  sum(output_tokens) as output_tokens,
  sum(thoughts_tokens) as thoughts_tokens,
  sum(total_tokens) as total_tokens
from public.scan_calls
group by 1, 2;

revoke all on public.scan_costs_daily from anon, authenticated;

-- ============================================================================
-- 20260925100000_premium.sql
-- ============================================================================
-- Premium payant (Chariow) : durée d'abonnement et historique des paiements.
-- premium_until : fin de l'accès Premium. NULL avec plan = 'premium' = Premium permanent
-- (compte du propriétaire de l'app, attribué à la main en SQL).

alter table public.profiles add column premium_until timestamptz;

comment on column public.profiles.premium_until is
  'Fin du Premium payé ; NULL avec plan premium = permanent. Modifiable uniquement par le service role.';

-- Plan réellement applicable : un Premium expiré redevient gratuit.
create or replace function public.effective_plan(p_plan text, p_premium_until timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_plan = 'premium' and (p_premium_until is null or p_premium_until > now()) then 'premium'
    else 'free'
  end;
$$;

-- Les deux fonctions de quota tiennent compte de l'expiration.
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
  select public.effective_plan(p.plan, p.premium_until) into v_plan from public.profiles p where p.id = p_user_id;
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
        coalesce((select public.effective_plan(p.plan, p.premium_until) from public.profiles p where p.id = auth.uid()), 'free'),
        coalesce((select u.is_anonymous from auth.users u where u.id = auth.uid()), false)
      ) as quota
  )
  select used, quota, greatest(quota - used, 0) from me
  where auth.uid() is not null;
$$;

-- Limites choisies : invité 1, gratuit 3, Premium 30 scans par jour.
-- (Redéfinie ici au cas où une version « illimitée » aurait été appliquée à la main.)
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

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------

create table public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'chariow' check (provider in ('chariow')),
  -- Identifiant de la vente chez le prestataire : une vente ne crédite qu'une fois.
  sale_id text not null unique,
  offer text not null check (offer in ('monthly', 'yearly')),
  days integer not null check (days > 0),
  amount numeric(12, 2),
  currency text,
  premium_until timestamptz,
  created_at timestamptz not null default now()
);

create index payments_user_created on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

create policy "paiements : lecture de soi"
on public.payments for select to authenticated
using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.payments from anon, authenticated;

-- Crédite une vente confirmée. Idempotent : une vente déjà enregistrée ne prolonge rien.
-- Un Premium permanent (premium_until NULL) reste permanent. Réservé au service role.
create or replace function public.grant_premium(
  p_user_id uuid,
  p_sale_id text,
  p_offer text,
  p_days integer,
  p_amount numeric default null,
  p_currency text default null
)
returns table (granted boolean, premium_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_payment_id bigint;
  v_plan text;
  v_until timestamptz;
begin
  insert into public.payments (user_id, sale_id, offer, days, amount, currency)
  values (p_user_id, p_sale_id, p_offer, p_days, p_amount, p_currency)
  on conflict (sale_id) do nothing
  returning id into v_payment_id;

  select p.plan, p.premium_until into v_plan, v_until from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'profil inconnu: %', p_user_id using errcode = 'P0002';
  end if;

  if v_payment_id is null then
    return query select false, v_until;
    return;
  end if;

  if not (v_plan = 'premium' and v_until is null) then
    -- Prolonge à partir de la fin actuelle si elle est dans le futur, sinon à partir de maintenant.
    v_until := greatest(coalesce(v_until, now()), now()) + make_interval(days => p_days);
    update public.profiles set plan = 'premium', premium_until = v_until where id = p_user_id;
  end if;

  update public.payments set premium_until = v_until where id = v_payment_id;
  return query select true, v_until;
end;
$$;

revoke execute on function public.grant_premium(uuid, text, text, integer, numeric, text) from public, anon, authenticated;

-- ============================================================================
-- Table des plats (valeurs approximatives à vérifier, voir docs/FOODS_TODO.md)
-- ============================================================================
-- Généré par scripts/seed-foods.mjs à partir de supabase/seed/foods.json. Ne pas modifier à la main.
-- Valeurs nutritionnelles APPROXIMATIVES, à vérifier (voir docs/FOODS_TODO.md).

insert into public.foods
  (food_key, label_fr, aliases, categorie, kcal_100g, proteines_100g, glucides_100g, lipides_100g, portion_reperes, source, verified)
values
  ('riz_blanc', 'Riz blanc cuit', array['riz nature', 'riz sauce']::text[], 'feculent', 130, 2.7, 28.2, 0.3, '{"cuillere":20,"bol":200,"assiette":300}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('riz_jollof', 'Riz jollof / riz au gras', array['jollof', 'riz au gras', 'riz gras']::text[], 'feculent', 170, 3.2, 26, 6, '{"cuillere":20,"bol":220,"assiette":330}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('atassi', 'Atassi (riz et haricots)', array['watchi', 'waakye', 'riz haricot']::text[], 'feculent', 150, 5, 27, 2.2, '{"bol":220,"assiette":350}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('attieke', 'Attiéké', array['atieke', 'acheke']::text[], 'feculent', 157, 1, 37, 0.5, '{"cuillere":20,"bol":180,"assiette":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('pate_mais', 'Pâte de maïs blanche (wɔ, owo)', array['wo', 'owo', 'pâte blanche', 'akoumé', 'tô', 'ugali']::text[], 'feculent', 110, 2.5, 24, 0.6, '{"boule":300,"assiette":400}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('amiwo', 'Amiwo (pâte rouge)', array['pâte rouge', 'djenkoumé']::text[], 'feculent', 150, 3, 25, 4.5, '{"boule":300,"assiette":400}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('akassa', 'Akassa / agidi (pâte de maïs fermentée)', array['agidi', 'eko', 'ablo']::text[], 'feculent', 80, 1.5, 18, 0.3, '{"unite":150}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('igname_pilee', 'Igname pilée (foufou d''igname)', array['foufou', 'fufu', 'agou', 'pounded yam', 'télibo']::text[], 'feculent', 130, 1.5, 31, 0.2, '{"boule":350}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('foufou_manioc', 'Foufou de manioc', array['fufu manioc', 'placali', 'kokonte']::text[], 'feculent', 155, 0.8, 37, 0.3, '{"boule":300}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('gari', 'Gari sec (semoule de manioc)', array['garri', 'tapioca gari']::text[], 'feculent', 360, 1.2, 86, 0.5, '{"cuillere":12,"bol":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('eba', 'Eba / piron (gari à l''eau chaude)', array['piron', 'eba']::text[], 'feculent', 150, 0.5, 36, 0.2, '{"boule":300}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('haricots_niebe', 'Haricots niébé cuits', array['haricot', 'niébé', 'ayikoun', 'beans']::text[], 'feculent', 116, 7.7, 21, 0.5, '{"louche":150,"bol":200}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('alloco', 'Alloco (banane plantain frite)', array['aloko', 'dodo', 'plantain frit']::text[], 'feculent', 260, 1.3, 38, 12, '{"morceau":15,"assiette":200}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('plantain_bouilli', 'Banane plantain bouillie', array['plantain cuit', 'agbôkin']::text[], 'feculent', 123, 0.8, 31.2, 0.2, '{"unite":180}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('igname_bouillie', 'Igname bouillie', array['igname cuite']::text[], 'feculent', 115, 1.5, 27.5, 0.1, '{"morceau":100}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('igname_frite', 'Igname frite', array['frites d''igname', 'dundun']::text[], 'feculent', 230, 2, 32, 10.5, '{"morceau":40,"assiette":200}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('manioc_bouilli', 'Manioc bouilli', array['manioc cuit', 'bâton de manioc', 'chikwangue']::text[], 'feculent', 125, 1, 30, 0.3, '{"morceau":100}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('pain', 'Pain (baguette)', array['baguette', 'pain blanc']::text[], 'feculent', 270, 9, 55, 1.5, '{"morceau":60,"unite":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('spaghetti', 'Spaghetti cuits', array['pâtes', 'macaroni', 'spaghetti sautés']::text[], 'feculent', 158, 5.8, 31, 0.9, '{"assiette":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('couscous_mil', 'Couscous de mil (thiéré)', array['thiéré', 'cere', 'couscous']::text[], 'feculent', 140, 3.5, 29, 1, '{"bol":200,"assiette":300}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('bouillie_mil', 'Bouillie de mil sucrée', array['koko', 'hausa koko', 'bouillie', 'lakh', 'ogi']::text[], 'feculent', 67, 1.3, 14, 0.6, '{"bol":300}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('bouillie_mais', 'Bouillie de maïs sucrée (akassa délayé)', array['koko maïs', 'pap', 'akamu']::text[], 'feculent', 60, 1, 13, 0.4, '{"bol":300}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('thieboudienne', 'Thiéboudienne (riz au poisson)', array['ceebu jën', 'tieb', 'riz au poisson']::text[], 'plat_complet', 160, 8, 20, 5.5, '{"assiette":450}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('poulet_dg', 'Poulet DG', array['poulet directeur général']::text[], 'plat_complet', 190, 10, 15, 10, '{"assiette":350}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('yassa_poulet', 'Poulet yassa (sans riz)', array['yassa']::text[], 'plat_complet', 150, 13, 6, 8, '{"louche":150,"assiette":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('degue', 'Dèguè / thiakry (mil au lait caillé)', array['dèguè', 'thiakry', 'dégué']::text[], 'plat_complet', 150, 4, 24, 4, '{"bol":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_graine', 'Sauce graine (noix de palme)', array['banga', 'sauce palmiste', 'abenkwan']::text[], 'sauce', 180, 4, 5, 16, '{"louche":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_arachide', 'Sauce arachide (mafé)', array['mafé', 'maafe', 'groundnut soup', 'azindessi']::text[], 'sauce', 173, 7, 6, 13.5, '{"louche":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_tomate', 'Sauce tomate à l''huile', array['sauce rouge', 'stew', 'sauce tomate']::text[], 'sauce', 93, 1.5, 6, 7, '{"louche":100}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_feuilles', 'Sauce feuilles (gboma, épinards)', array['gboma dessi', 'sauce feuille', 'efo riro', 'sauce épinard']::text[], 'sauce', 113, 4, 4, 9, '{"louche":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_gombo', 'Sauce gombo', array['gombo', 'okra', 'févi', 'fetri']::text[], 'sauce', 70, 2.5, 5, 4.5, '{"louche":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_crincrin', 'Sauce crincrin (corète)', array['crincrin', 'ewedu', 'adémè']::text[], 'sauce', 44, 2.5, 4, 2, '{"louche":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_pistache', 'Sauce pistache / egusi', array['egusi', 'agoussi', 'sauce pistache']::text[], 'sauce', 200, 9, 5, 16, '{"louche":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_claire', 'Sauce claire / soupe de poisson', array['pepper soup', 'light soup', 'sauce claire']::text[], 'sauce', 46, 5, 2.5, 1.8, '{"louche":150}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('ndole', 'Ndolé', array['ndole']::text[], 'sauce', 150, 9, 5, 10.5, '{"louche":150}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sauce_feuille_manioc', 'Sauce feuilles de manioc (saka-saka)', array['saka saka', 'pondu', 'pondou', 'sauce feuille manioc']::text[], 'sauce', 121, 4, 6, 9, '{"louche":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('poulet_braise', 'Poulet braisé', array['poulet grillé', 'poulet bicyclette braisé', 'choukouya poulet']::text[], 'proteine', 208, 25, 0, 12, '{"morceau":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('poulet_frit', 'Poulet frit', array['poulet sauté']::text[], 'proteine', 251, 24, 5, 15, '{"morceau":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('poisson_braise', 'Poisson braisé (tilapia, carpe)', array['poisson grillé', 'tilapia braisé', 'carpe braisée']::text[], 'proteine', 149, 22, 0, 6.8, '{"unite":300,"morceau":100}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('poisson_frit', 'Poisson frit', array['friture de poisson', 'fritures', 'chinchard frit']::text[], 'proteine', 218, 20, 3, 14, '{"morceau":80,"unite":150}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('poisson_fume', 'Poisson fumé', array['poisson sec', 'kpanla fumé', 'akpavi']::text[], 'proteine', 280, 45, 0, 11, '{"morceau":30}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('crevettes_sechees', 'Crevettes séchées', array['crevettes', 'ablo crevette']::text[], 'proteine', 280, 60, 2, 3, '{"cuillere":8}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('viande_boeuf', 'Viande de bœuf cuite', array['boeuf', 'viande', 'bœuf sauce']::text[], 'proteine', 221, 26, 0, 13, '{"morceau":40}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('viande_chevre', 'Viande de chèvre / mouton cuite', array['chèvre', 'mouton', 'cabri', 'agneau']::text[], 'proteine', 140, 27, 0, 3.5, '{"morceau":40}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('suya', 'Suya / choukouya (brochette grillée)', array['choukouya', 'brochette', 'kilichi', 'dibi']::text[], 'proteine', 249, 28, 5, 13, '{"unite":60}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('oeuf_dur', 'Œuf dur', array['oeuf', 'œuf bouilli']::text[], 'proteine', 152, 12.6, 1.1, 10.6, '{"unite":50}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('omelette', 'Omelette', array['oeuf frit', 'omelette pain']::text[], 'proteine', 189, 12, 1.5, 15, '{"unite":90}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('wagashi', 'Wagashi (fromage peul)', array['wagasi', 'fromage peul', 'waragashi']::text[], 'proteine', 202, 16, 3, 14, '{"morceau":60}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('wagashi_frit', 'Wagashi frit', array['fromage peul frit']::text[], 'proteine', 300, 17, 4, 24, '{"morceau":60}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('fromage_soja', 'Fromage de soja frit (tofu)', array['tofu', 'soja frit', 'fromage de soja']::text[], 'proteine', 280, 17, 9, 20, '{"morceau":50}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('beignets_haricot', 'Beignets de haricot (ata, akara)', array['ata', 'akara', 'accra', 'klaklou haricot']::text[], 'proteine', 290, 10, 22, 18, '{"unite":25}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('crudites', 'Crudités (salade, tomate, oignon, sans sauce)', array['salade', 'tomate oignon']::text[], 'legume', 20, 1, 3.5, 0.2, '{"assiette":100}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('avocat', 'Avocat', array['avocat']::text[], 'fruit', 160, 2, 8.5, 14.7, '{"unite":150}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('banane_douce', 'Banane douce', array['banane']::text[], 'fruit', 89, 1.1, 22.8, 0.3, '{"unite":120}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('mangue', 'Mangue', array['mango']::text[], 'fruit', 60, 0.8, 15, 0.4, '{"unite":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('ananas', 'Ananas', array['ananas']::text[], 'fruit', 50, 0.5, 13, 0.1, '{"morceau":80}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('orange', 'Orange', array['orange']::text[], 'fruit', 47, 0.9, 11.8, 0.1, '{"unite":150}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('papaye', 'Papaye', array['papaye']::text[], 'fruit', 43, 0.5, 9.8, 0.3, '{"morceau":150}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('huile_palme', 'Huile de palme (rouge)', array['zomi', 'huile rouge']::text[], 'matiere_grasse', 884, 0, 0, 100, '{"cuillere":13}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('huile_vegetale', 'Huile végétale (arachide, soja, tournesol)', array['huile', 'huile d''arachide']::text[], 'matiere_grasse', 884, 0, 0, 100, '{"cuillere":13}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('mayonnaise', 'Mayonnaise', array['mayo']::text[], 'matiere_grasse', 680, 1, 1, 75, '{"cuillere":15}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('arachides_grillees', 'Arachides grillées', array['cacahuètes', 'arachides', 'kouli-kouli']::text[], 'snack', 590, 25, 16, 49, '{"poignee":30}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('beignet_farine', 'Beignet de farine (botokoin, puff-puff)', array['botokoin', 'puff puff', 'gaou', 'beignet']::text[], 'snack', 340, 6, 45, 15, '{"unite":40}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('chips_plantain', 'Chips de plantain', array['chips banane', 'plantain chips']::text[], 'snack', 528, 2, 58, 32, '{"sachet":50}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('bissap', 'Bissap sucré', array['jus d''oseille', 'zobo', 'foléré']::text[], 'boisson', 45, 0, 11, 0, '{"verre":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('jus_gingembre', 'Jus de gingembre sucré', array['gingembre', 'ginger']::text[], 'boisson', 50, 0, 12.5, 0, '{"verre":250}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('soda', 'Soda sucré', array['coca', 'fanta', 'sucrerie']::text[], 'boisson', 42, 0, 10.6, 0, '{"canette":330,"bouteille":500}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('lait_concentre', 'Lait concentré sucré', array['lait concentré', 'lait sucré']::text[], 'sucre', 321, 7.9, 54.4, 8.7, '{"cuillere":20}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false),
  ('sucre', 'Sucre', array['sucre en poudre', 'morceau de sucre']::text[], 'sucre', 400, 0, 100, 0, '{"cuillere":5,"morceau":5}'::jsonb, 'Estimation à vérifier – cible : Table de composition des aliments d''Afrique de l''Ouest (FAO/INFOODS, 2019)', false)
on conflict (food_key) do update set
  label_fr = excluded.label_fr,
  aliases = excluded.aliases,
  categorie = excluded.categorie,
  kcal_100g = excluded.kcal_100g,
  proteines_100g = excluded.proteines_100g,
  glucides_100g = excluded.glucides_100g,
  lipides_100g = excluded.lipides_100g,
  portion_reperes = excluded.portion_reperes,
  source = excluded.source,
  verified = excluded.verified;

commit;

select 'Installation Calbasse terminée : ' || count(*) || ' plats chargés' as resultat from public.foods;
