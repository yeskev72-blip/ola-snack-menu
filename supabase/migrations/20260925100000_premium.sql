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

-- Limites choisies : invité 1, gratuit 2, Premium 30 scans par jour.
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
    else 2
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
